# -*- coding: utf-8 -*-
from flask import Flask, render_template, request, jsonify, send_from_directory, redirect, url_for, session , send_file, abort , flash
from flask_socketio import SocketIO, emit, join_room
import os
import json
import time
import requests 
import random
import uuid  # 🔥 Добавьте в начало файла
from datetime import datetime , timedelta , timezone
from user_agents import parse
from flask_cors import CORS
from werkzeug.utils import secure_filename
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import send_from_directory, make_response
import numpy as np
from flask_mail import Mail, Message

# Initialize app and socket
app = Flask(__name__)
app.secret_key = os.urandom(32)
app.config['DEBUG'] = True
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {...}

# Unified SocketIO initialization
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading"
)

serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
CORS(app)


# Initialize messages as an empty list, not a dictionary
messages = []  # Store messages locally

API_KEY_EXPIRATION = 10

exam_duration = 11 * 60  # 30 minutes in seconds
exam_start_time = None  # Global variable to store exam start time
exam_started = False  # Флаг начала экзамена
exam_end_time = None


NOTIFICATIONS_FILE = 'users_notifications.json'

def load_data():
    if not os.path.exists(NOTIFICATIONS_FILE):
        with open(NOTIFICATIONS_FILE, 'w') as f:
            json.dump({"general": {}, "important": {}}, f)
    with open(NOTIFICATIONS_FILE, 'r') as f:
        return json.load(f)

def save_data(data):
    with open(NOTIFICATIONS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/api/notifications/general/<username>')
def get_general(username):
    data = load_data()
    return jsonify({
        "notifications": data["general"].get(username, [])
    })

@app.route('/api/notifications/important', methods=['GET'])
def get_important_notifications():
    data = load_data()
    return jsonify({ "notifications": data.get("important", []) })


@app.route('/api/general/add/<username>', methods=['POST'])
def add_general(username):
    payload = request.get_json()
    title = payload.get('title', 'Notification')
    message = payload.get('message', '')
    
    data = load_data()
    data.setdefault("general", {}).setdefault(username, []).append({
        "title": title,
        "message": message
    })
    save_data(data)
    return jsonify({"status": "ok"}), 201


@app.route('/api/important/add', methods=['POST'])
def add_important():
    payload = request.get_json()
    title = payload.get('title', 'Important Notice')
    message = payload.get('message', '')

    data = load_data()

    # если important не список — заменяем
    if not isinstance(data.get("important"), list):
        data["important"] = []

    data["important"].append({
        "title": title,
        "message": message
    })
    socketio.emit('new_notification', {'message': 'New notification added!'})
    save_data(data)
    return jsonify({"status": "ok"}), 201



USER_DATA_FILE = "users.json"
MESSAGE_DATA_FILE = "messages.json"
exam_passed = []

AVATAR_FOLDER = "static/avatars"
USER_AVATAR_FILE = "users_avatar.json"

app.config["AVATAR_FOLDER"] = AVATAR_FOLDER
app.config["ALLOWED_IMAGE_EXTENSIONS"] = {"png", "jpg", "jpeg", "gif"}

active_keys = {}
BASE_DIR = os.path.abspath("homework_files")

@app.route('/generate-key', methods=['POST'])
def generate_api_key():
    # Генерация ключа без передачи user_id в payload
    api_key = serializer.dumps({})
    return jsonify({'api_key': api_key, 'expires_in': API_KEY_EXPIRATION})

def verify_api_key(token):
    """Валидация ключа. Возвращает True, если ключ валиден, или False в случае ошибки."""
    try:
        # Проверка валидности токена (не извлекаем user_id)
        payload = serializer.loads(token, max_age=API_KEY_EXPIRATION)
        print(f"Token Payload: {payload}")  # Логируем данные токена
        return True  # Токен валиден
    except SignatureExpired:
        print("Token expired!")
        return 'expired'
    except BadSignature:
        print("Invalid token!")
        return False

@app.route('/api/homework/<unit>', methods=['GET'])
def get_homework(unit):
    # Получаем ключ из заголовка
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Missing token'}), 403

    token = auth_header.split(' ')[1]
    print(f"Received Token: {token}")  # Логируем токен

    # Проверка валидности токена
    if verify_api_key(token) == 'expired':
        return jsonify({'error': 'Token expired'}), 401
    if not verify_api_key(token):
        return jsonify({'error': 'Invalid token'}), 403

    # Загружаем файл
    filename = f"Unit{unit}.json"
    filepath = os.path.join(BASE_DIR, filename)

    if not os.path.isfile(filepath):
        return jsonify({'error': 'File not found'}), 404

    return send_file(filepath, mimetype='application/json')



@app.route('/api/get_exam_times', methods=['GET'])
def get_exam_times():
    current_time = time.time()  # текущее время в секундах
    return jsonify({
        "current_time": current_time,
        "exam_start_time": exam_start_time,
        "exam_end_time": exam_end_time
    })
        
if not os.path.exists(AVATAR_FOLDER):
    os.makedirs(AVATAR_FOLDER)

if not os.path.exists(USER_AVATAR_FILE):
    with open(USER_AVATAR_FILE, "w") as f:
        json.dump({}, f)

def allowed_image(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in app.config["ALLOWED_IMAGE_EXTENSIONS"]
    
def initialize_users_data_file():
    if not os.path.exists(USER_AVATAR_FILE):
        with open(USER_AVATAR_FILE, "w") as f:
            json.dump({}, f)
    try:
        with open(USER_AVATAR_FILE, "r") as f:
            users = json.load(f)
    except json.JSONDecodeError:  # Handle case if the file is corrupted or empty
        with open(USER_AVATAR_FILE, "w") as f:
            json.dump({}, f)  # Reset to an empty object
        users = {}
    return users

PROGRESS_FILE = 'students_progress.json'

# Функция для загрузки данных из JSON файла
def load_progress():
    try:
        with open(PROGRESS_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

# Функция для сохранения данных в JSON файл
def save_progress(data):
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(data, f, indent=4)

# Функция для получения прогресса студента
def get_student_progress():
    return load_progress()
    
@app.route('/api/get-leaderboard', methods=['GET'])
def get_leaderboard_myprogress():

    # Получаем прогресс всех студентов
    progress_data = get_student_progress()

    if not progress_data:
        return jsonify({"error": "No student progress data found"}), 404  # Если данных нет, возвращаем ошибку

    # Подготовка данных для таблицы
    leaderboard = {}

    for student, data in progress_data.items():
        raw_progress = data.get("progress", 0)
        rounded_progress = round(raw_progress, 2)  # Округляем до двух знаков после запятой

        leaderboard[student] = {
            "progress": rounded_progress,
            "start_date": data.get("start_date", None),
            "study_days": data.get("study_days", "odd")  # Default "odd" if not provided
        }

    # Возвращаем все данные о студентах в формате JSON
    return jsonify(leaderboard)
    
@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        with open('users.json', 'r') as file:
            users = json.load(file)
        return jsonify(users)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-student-progress', methods=['GET'])
def get_progress():

    # Получаем имя пользователя из параметров запроса
    current_user = request.args.get("username")
    
    if not current_user:
        return jsonify({"error": "Username is required"}), 400  # Если имя не передано, возвращаем ошибку

    # Получаем прогресс всех студентов
    progress_data = get_student_progress()  # Здесь предполагается, что эта функция возвращает словарь всех студентов и их прогресса
    
    # Если пользователь не найден в данных, возвращаем ошибку "notfound"
    if current_user not in progress_data:
        return jsonify({"error": "Student not found"}), 404  # Ошибка 404 если пользователь не найден

    # Получаем прогресс, start_date и study_days для найденного пользователя
    student_data = progress_data[current_user]
    progress = student_data.get("progress", 0)
    start_date = student_data.get("start_date", None)
    study_days = student_data.get("study_days", None)  # Получаем study_days
    midterm = student_data.get("midterm-exam", None)
    final = student_data.get("final-exam", None)

    # Возвращаем прогресс, start_date и study_days для указанного пользователя
    return jsonify({current_user: {"progress": progress, "start_date": start_date, "study_days": study_days,"midterm-exam": midterm, "final-exam": final}})
    
@app.route('/api/get-student-names', methods=['GET'])
def get_student_names():
    try:
        with open(PROGRESS_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)
            student_names = list(data.keys())  # Получаем только ключи (имена студентов)
            return jsonify({"students": student_names})
    except Exception as e:
        return jsonify({"error": str(e)}), 500  # Ошибка сервера


@app.route('/api/update-student-progress', methods=['POST'])
def update_progress():
    data = request.json
    username = data.get('username')
    progress = data.get('progress')
    start_date = data.get('start_date')  # Получаем дату начала курса из запроса

    if not username or progress is None:
        return jsonify({'error': 'Invalid input'}), 400

    # Обновляем прогресс студента и start_date (если передан start_date)
    update_student_progress(username, progress, start_date)
    
    return jsonify({'success': True, 'message': 'Progress updated successfully'})

# Функция для обновления прогресса студента и start_date
def update_student_progress(username, progress, start_date):
    progress_data = load_progress()  # Загружаем текущие данные
    
    # Если студент не найден, добавляем его
    if username not in progress_data:
        progress_data[username] = {
            "progress": progress,
            "start_date": start_date  # Если start_date передан, он будет обновлен
        }
    else:
        # Обновляем только прогресс
        progress_data[username]["progress"] = progress
        
        # Если start_date передан, обновляем его
        if start_date:
            progress_data[username]["start_date"] = start_date

    save_progress(progress_data)
    
@app.route('/api/update-student-progress-exam', methods=['POST'])
def update_progress_exam():
    data = request.json
    username = data.get('username')
    progress_increment = data.get('progress')  # Это не новый прогресс, а процент, который нужно добавить

    if not username or progress_increment is None:
        return jsonify({'error': 'Invalid input'}), 400

    progress_data = load_progress()

    # Если студент новый, создаем запись
    if username not in progress_data:
        progress_data[username] = {"progress": 0}

    # Обновляем прогресс (старое значение + новое)
    current_progress = float(progress_data[username]["progress"])
    new_progress = min(100, current_progress + float(progress_increment))  # Ограничиваем 100%

    progress_data[username]["progress"] = new_progress
    save_progress(progress_data)

    return jsonify({'success': True, 'message': 'Progress updated successfully', 'new_progress': new_progress})

    
@socketio.on('typing')
def handle_typing(data):
    emit('user_typing', data, broadcast=True, include_self=False)  # Рассылаем всем, кроме отправителя

# Событие "пользователь перестал печатать"
@socketio.on('stop_typing')
def handle_stop_typing(data):
    emit('user_stopped_typing', data, broadcast=True, include_self=False)

@app.route("/upload_avatar", methods=["POST"])
def upload_avatar():
    if "file" not in request.files or "username" not in request.form:
        return jsonify({"error": "No file or username provided"}), 400

    file = request.files["file"]
    username = request.form["username"]

    if file and allowed_image(file.filename):
        filename = secure_filename(f"{username}_{file.filename}")
        filepath = os.path.join(app.config["AVATAR_FOLDER"], filename)
        file.save(filepath)

        # Load users data and update it
        users = initialize_users_data_file()

        # Update user data with new avatar
        users[username] = f"/static/avatars/{filename}"

        # Save the updated data
        with open(USER_AVATAR_FILE, "w") as f:
            json.dump(users, f, indent=4)

        return jsonify({"message": "Avatar uploaded successfully", "avatar_url": users[username]})

    return jsonify({"error": "Invalid file type"}), 400
    
@app.route("/get_avatar/<username>", methods=["GET"])
def get_avatar(username):
    username = username.strip()
    
    if not os.path.exists(USER_AVATAR_FILE):
        return jsonify({"avatar_url": None})

    try:
        with open(USER_AVATAR_FILE, "r") as f:
            users = json.load(f)
        avatar_url = users.get(username)
    except Exception:
        avatar_url = None

    return jsonify({"avatar_url": avatar_url})
        
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def load_bought_themes():
    try:
        with open('bought.json', 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        return {}

# Функция для сохранения купленных тем
def save_bought_themes(data):
    with open('bought.json', 'w') as file:
        json.dump(data, file)

def load_file(file_path, default_value):
    """Load a file or return default value if file is not found."""
    if not os.path.exists(file_path) or os.stat(file_path).st_size == 0:
        return default_value
    with open(file_path, 'r') as file:
        return json.load(file)
        
def save_file(file_path, data):
    with open(file_path, 'w') as file:
        json.dump(data, file, indent=4)
    
TRANSACTIONS_FILE = "users_transactions.json"   
 
def load_balances():
    try:
        with open('balance.json', 'r') as f:
            data = json.load(f)
        return {user: float(balance) for user, balance in data.items()}
    except (FileNotFoundError, ValueError):
        return {}

def store_balances(balances):
    with open(BALANCE_FILE, "w") as f:
        json.dump(balances, f, indent=4) 

def load_transactions():
    if os.path.exists(TRANSACTIONS_FILE):
        with open(TRANSACTIONS_FILE, "r") as f:
            return json.load(f)
    return {}
   
@app.route('/api/points_history/<username>', methods=['GET'])
def get_points_history(username):
    transactions = load_transactions()
    user_history = transactions.get(username, [])

    # Сортируем по времени (строковое представление ISO‑формата или похожее)
    sorted_history = sorted(
        user_history,
        key=lambda entry: entry.get("time", ""),
        reverse=True
    )

    # Берём только 7 самых свежих записей
    latest_entries = sorted_history[:7]

    # Форматируем для ответа
    formatted_history = []
    for entry in latest_entries:
        amount = entry.get("amount")
        description = entry.get("description", "No description")
        timestamp = entry.get("time", "Unknown time")
        balance_before = entry.get("balance_before", 0.0)
        if isinstance(amount, (int, float)):
            formatted_history.append({
                "amount": amount,
                "description": description,
                "time": timestamp,
                "balance_before": balance_before
            })

    return jsonify({
        "username": username,
        "history": formatted_history
    })

    
import threading

# File paths
ITEMS_FILE = 'data/items.json'
INVENTORY_FILE = 'users_inventory.json'

# Thread lock for file writes
data_lock = threading.Lock()

# Utility functions

def load_json(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def store_json(path, data):
    with data_lock:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

# Load items
def load_items():
    return load_json(ITEMS_FILE)

def store_items(items):
    store_json(ITEMS_FILE, items)

# Load/store inventory

def load_user_inventory():
    return load_json(INVENTORY_FILE)

def store_user_inventory(data):
    store_json(INVENTORY_FILE, data)
    
def load_inventory_all():
    if not os.path.exists(INVENTORY_FILE):
        return {}
    with open(INVENTORY_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_inventory_all(data):
    with open(INVENTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_inventory_for_user(username):
    all_data = load_inventory_all()
    return all_data.get(username, [])

def save_inventory_for_user(username, user_inventory):
    all_data = load_inventory_all()
    all_data[username] = user_inventory
    save_inventory_all(all_data)

@app.route('/api/items')
def get_items():
    items = load_items()
    return jsonify(items)


@app.route('/api/purchase', methods=['POST'])
def purchase():
    data = request.json or {}
    item_id = data.get('id')
    username = data.get('username')
    amount = data.get('amount', 0)

    if not username:
        return jsonify({'success': False, 'message': 'Username required'}), 400

    # Load data
    items = load_items()
    coins_data = load_user_coins()
    inv_data = load_user_inventory()

    # Find item
    item = next((i for i in items if i['id'] == item_id), None)
    if not item:
        return jsonify({'success': False, 'message': 'Item not found'}), 404
    if item.get('items_left', 0) <= 0:
        return jsonify({'success': False, 'message': 'Out of stock'}), 400

    # Delegate coin deduction
    sub_resp = app.test_client().post(
        '/api/subtract_coins',
        json={'username': username, 'amount': amount}
    )
    sub_data = sub_resp.get_json()
    if not sub_data.get('success'):
        return jsonify(sub_data), sub_resp.status_code

    # ✅ Добавляем транзакцию
    add_transaction_internal(
        username=username,
        amount=-0,
        description=f"Purchased from shop with coins : {item['name']}"
    )

    # Decrement stock
    item['items_left'] -= 1
    store_items(items)

    # Update user inventory
    user_inv = inv_data.get(username, [])
    purchase_record = {
        'id': item['id'],
        'name': item['name'],
        'cost': amount,
        'type': item.get('type', 'Unknown'),
        'image': item.get('image', '/static/images/default.png'),
        'time': (datetime.utcnow() + timedelta(hours=5)).isoformat()
    }
    user_inv.append(purchase_record)
    inv_data[username] = user_inv
    store_user_inventory(inv_data)

    return jsonify({
        'success': True,
        'item': item,
        'coins': sub_data['coins']
    })


@app.route('/api/inventory/<username>')
def inventory(username):
    inv_data = load_user_inventory()
    user_inv = inv_data.get(username, [])
    return jsonify(user_inv)
    
STATUS_FILE = 'data/status.json'

def load_status_data():
    if not os.path.exists(STATUS_FILE):
        return {}
    with open(STATUS_FILE, 'r') as f:
        return json.load(f)

def save_status_data(data):
    with open(STATUS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/api/item-status/<int:item_id>')
def item_status(item_id):
    username = request.args.get('username')
    if not username:
        return jsonify({'status': 'Product in packaging'}), 400

    data = load_status_data()

    # Гарантируем структуру: data[username]['items']
    if username not in data:
        data[username] = {'items': {}}
    if 'items' not in data[username]:
        data[username]['items'] = {}

    items = data[username]['items']
    item_id_str = str(item_id)

    # Если предмет отсутствует — создаём со статусом 
    if item_id_str not in items:
        items[item_id_str] = {'status': 'Product in packaging'}
        save_status_data(data)

    return jsonify(items[item_id_str])
    
@app.route('/api/inventory-delete', methods=['POST'])
def delete_inventory_item():
    data = request.json or {}
    username = data.get('username')
    index = data.get('index')

    if not username or index is None:
        return jsonify({'success': False, 'message': 'Missing data'}), 400

    inv_data = load_user_inventory()
    user_inv = inv_data.get(username)
    if not user_inv or index >= len(user_inv):
        return jsonify({'success': False, 'message': 'Invalid index'}), 400

    del user_inv[index]
    inv_data[username] = user_inv
    store_user_inventory(inv_data)
    return jsonify({'success': True})


@app.route('/api/item-status-update', methods=['POST'])
def update_item_status():
    data = request.json or {}
    username = data.get('username')
    item_id = str(data.get('item_id'))
    new_status = data.get('status')

    if not username or not item_id or not new_status:
        return jsonify({'success': False, 'message': 'Missing data'}), 400

    status_data = load_status_data()
    if username not in status_data:
        status_data[username] = {'items': {}}
    if 'items' not in status_data[username]:
        status_data[username]['items'] = {}

    status_data[username]['items'][item_id] = {'status': new_status}
    save_status_data(status_data)
    return jsonify({'success': True})

@app.route('/api/inventory-update', methods=['POST'])
def update_inventory():
    data = request.json
    username = data.get("username")
    index = data.get("index")
    cost = data.get("cost")
    quantity = data.get("quantity")

    # Загрузка и обновление данных
    inventory = load_inventory_for_user(username)
    if 0 <= index < len(inventory):
        inventory[index]["cost"] = cost
        inventory[index]["quantity"] = quantity
        save_inventory_for_user(username, inventory)
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Invalid index"})



@app.route('/api/view/<item_id>')
def api_item_data(item_id):
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        with open('users_inventory.json', 'r', encoding='utf-8') as f:
            inv_data = json.load(f)
    except Exception as e:
        return jsonify({'error': 'Failed to load inventory', 'details': str(e)}), 500

    user_items = inv_data.get(username, [])
    
    # Проверка: есть ли у пользователя предмет с таким item_id (как строка или int)
    has_access = any(str(item.get('id')) == str(item_id) for item in user_items)
    if not has_access:
        return jsonify({'error': 'Access denied'}), 403

    folder = os.path.join('static', 'cdn', item_id)
    if os.path.exists(folder):
        files = [
            f for f in os.listdir(folder)
            if os.path.isfile(os.path.join(folder, f))
        ]
        return jsonify({'files': files})
    return jsonify({'files': []})


@app.route('/view/<item_id>')
def render_viewer(item_id):
    return render_template("viewer.html", item_id=item_id)

def store_transactions(transactions):
    with open(TRANSACTIONS_FILE, "w") as f:
        json.dump(transactions, f, indent=4)
        
@app.route('/api/add_transaction', methods=['POST'])
def add_transaction():
    data = request.json
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    username = data.get("username")
    amount = data.get("amount")
    description = data.get("description", "")

    if not username or amount is None:
        return jsonify({"error": "username and amount are required"}), 400

    balances = load_balances()
    transactions = load_transactions()

    # Если пользователя нет — инициализируем баланс и список транзакций.
    if username not in balances:
        balances[username] = 0.0
    if username not in transactions:
        transactions[username] = []

    # Сохраняем баланс до транзакции
    balance_before = balances[username]

    # Обновляем баланс
    balances[username] += amount

    # Создаём запись транзакции
    transaction_record = {
        "amount": amount,
        "description": description,
        "time": (datetime.utcnow() + timedelta(hours=5)).isoformat(),
        "balance_before": balance_before
    }
    transactions[username].append(transaction_record)

    # Сохраняем обновлённые данные
    store_balances(balances)
    store_transactions(transactions)

    return jsonify({
        "message": "Transaction added",
        "username": username,
        "balance_before": balance_before,
        "amount": amount,
        "new_balance": balances[username]
    })
    
@app.route('/api/get_balance/<username>', methods=['GET'])
def get_balance(username):
    balances = load_balances()
    transactions = load_transactions()
    if username not in balances:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "username": username,
        "balance": balances[username],
        "transactions": transactions.get(username, [])
    })

@app.route('/api/transfer', methods=['POST'])
def transfer_points():
    data = request.json
    if not data:
        return jsonify({"error": "No JSON data provided"}), 400

    sender = data.get("sender")
    receiver = data.get("receiver")
    amount = data.get("amount")

    if not sender or not receiver or amount is None:
        return jsonify({"error": "sender, receiver, and amount are required"}), 400

    if sender == receiver:
        return jsonify({"error": "Sender and receiver cannot be the same"}), 400

    balances = load_balances()
    transactions = load_transactions()

    if sender not in balances or balances[sender] < amount:
        return jsonify({"error": "Insufficient balance or sender not found"}), 400

    # Ensure both users exist
    if receiver not in balances:
        balances[receiver] = 0.0
    if sender not in transactions:
        transactions[sender] = []
    if receiver not in transactions:
        transactions[receiver] = []

    # Time now in UTC+5
    now = (datetime.utcnow() + timedelta(hours=5)).isoformat()

    # Record sender transaction
    transactions[sender].append({
        "amount": -amount,
        "description": f"Transferred to {receiver}",
        "time": now,
        "balance_before": balances[sender]
    })

    # Record receiver transaction
    transactions[receiver].append({
        "amount": amount,
        "description": f"Received from {sender}",
        "time": now,
        "balance_before": balances[receiver]
    })

    # Update balances
    balances[sender] -= amount
    balances[receiver] += amount

    # Save changes
    store_balances(balances)
    store_transactions(transactions)

    return jsonify({
        "message": "Transfer successful",
        "sender": sender,
        "receiver": receiver,
        "amount": amount,
        "sender_new_balance": balances[sender],
        "receiver_new_balance": balances[receiver]
    })

@app.route('/api/cancel_transfer', methods=['POST'])
def cancel_transfer():
    data = request.json
    transaction_id = data.get("transaction_id")
    username = data.get("username")

    balances = load_balances()
    transactions = load_transactions()

    user_txns = transactions.get(username, [])
    txn = next((t for t in user_txns if t["id"] == transaction_id), None)

    if not txn or not txn.get("can_cancel"):
        return jsonify({"error": "Transaction not found or cannot be canceled"}), 400

    txn_time = datetime.fromisoformat(txn["time"])
    if datetime.utcnow() - txn_time > timedelta(minutes=3):
        return jsonify({"error": "Cancelation window expired"}), 400

    # Отменить: списать у получателя, вернуть отправителю
    receiver_name = txn["description"].split(" to ")[-1]
    amount = txn["amount"]

    # Обратная запись для получателя
    if receiver_name in balances:
        balances[receiver_name] -= amount
        transactions[receiver_name] = [
            t for t in transactions[receiver_name]
            if not (t["description"].startswith("Received") and t["amount"] == amount and txn["time"] in t["time"])
        ]

    balances[username] += amount
    txn["description"] += " (Canceled)"
    txn["can_cancel"] = False

    store_balances(balances)
    store_transactions(transactions)

    return jsonify({"message": "Transaction canceled successfully."})


# 📦 ВНЕ функции get_balance:
def load_user_coins():
    try:
        with open("users_coins.json", "r") as f:
            return json.load(f)
    except:
        return {}

def store_user_coins(data):
    with open("users_coins.json", "w") as f:
        json.dump(data, f, indent=4)


def add_transaction_internal(username, amount, description):
    balances = load_balances()
    transactions = load_transactions()

    if username not in balances:
        balances[username] = 0.0
    if username not in transactions:
        transactions[username] = []

    # Сохраняем баланс до транзакции
    balance_before = balances[username]

    # Обновляем баланс
    balances[username] += amount

    # Создаём запись транзакции
    transaction_record = {
        "amount": amount,
        "description": description,
        "time": (datetime.utcnow() + timedelta(hours=5)).isoformat(),
        "balance_before": balance_before
    }
    transactions[username].append(transaction_record)

    # Сохраняем обновлённые данные
    store_balances(balances)
    store_transactions(transactions)

    return {
        "message": "Transaction added",
        "username": username,
        "balance_before": balance_before,
        "amount": amount,
        "new_balance": balances[username]
    }
    
@app.route('/api/exchange_points_to_coins', methods=['POST'])
def exchange_points_to_coins():
    data = request.get_json()
    username = data.get("username")
    points = data.get("points", 0)

    # Проверка: username должен быть, points ≥ 1000 и кратны 1000
    if not username or points < 1000 or points % 1000 != 0:
        return jsonify({"error": "Invalid request. Must send multiples of 1000 points."}), 400

    balances = load_balances()
    if username not in balances:
        return jsonify({"error": "User not found"}), 404

    current_points = balances[username]
    if current_points < points:
        return jsonify({"error": "Insufficient points"}), 400

    # Вычитаем points через add_transaction()
    sub_response = add_transaction_internal(username, -points, "Exchange to coins")
    if "error" in sub_response:
        return jsonify(sub_response), 400

    # Обмен: 1000 points = 1 coin
    coins_to_add = points // 1000
    user_coins = load_user_coins()
    user_coins[username] = user_coins.get(username, 0) + coins_to_add
    store_user_coins(user_coins)

    return jsonify({
        "message": "Exchange successful",
        "coins_added": coins_to_add,
        "new_coin_balance": user_coins[username],
        "remaining_points": balances[username]
    })

    
@app.route('/api/get_user_coins/<username>', methods=['GET'])
def get_user_coins(username):
    time.sleep(5)
    user_coins = load_user_coins()
    coins = user_coins.get(username, 0)
    return jsonify({"username": username, "coins": coins})
    
@app.route('/api/subtract_coins', methods=['POST'])
def subtract_coins():
    data = request.json
    username = data.get('username')
    amount = data.get('amount', 0)
    if not username:
        return jsonify({'success': False, 'message': 'Username required'}), 400

    user_coins = load_user_coins()
    current = user_coins.get(username, 0)
    if current < amount:
        return jsonify({'success': False, 'message': 'Not enough coins'}), 400

    user_coins[username] = current - amount
    store_user_coins(user_coins)
    return jsonify({'success': True, 'username': username, 'coins': user_coins[username]})

# Initialize loggedUsers from file
loggedUsers = load_file(USER_DATA_FILE, {})
messages = load_file(MESSAGE_DATA_FILE, [])

active_sessions = {}  # Track active sessions by username

current_version = "2025-01-10-v1"

exam_questions = [ 

  {
    "id": 1,
    "text": "Section 1. Listen and choose correct answer.",
    "type": "listening",
    "audio_Exam": "/static/exam-files/Section1.mp3",
    "subquestions": [
      {
        "id": "1.1",
        "type": "true_false",
        "text": "John works at Old Time Toys.",
        "correct": "False"
      },
      {
        "id": "1.2",
        "type": "multiple_choice",
        "text": "Marina wants ...",
        "options": [
          "product information, a brochure and prices.",
          "is warm in summer",
          "to call John again later."
        ],
        "correct": "product information, a brochure and prices."
      },
      {
        "id": "1.3",
        "type": "multiple_choice",
        "text": "Marina's number is ...",
        "options": [
          "0208 6557621",
          "0208 6656721",
          "0208 5718571",
          "200120969",
          "992320111"
        ],
        "correct": "0208 6557621"
      },
      {
        "id": "1.4",
        "type": "multiple_choice",
        "text": "Marina's email address is ...",
        "options": [
          "marina.silva@oldtime_toys.com",
          "marina.silva@oldtime-toys.com"
        ],
        "correct": "marina.silva@oldtime-toys.com"
      }
    ]
  },
    {
    "id": 4,
    "text": "Section 4. Listen and decide if the statements are true or false.",
    "type": "listening",
    "audio_Exam": "/static/exam-files/LE_listening_A1_Meeting_a_new_team_member.mp3",
    "subquestions": [
      {
        "id": "4.1",
        "type": "true_false",
        "text": "Peter is new in the company.",
        "correct": "True"
      },
      {
        "id": "4.2",
        "type": "true_false",
        "text": "Peter is a designer.",
        "correct": "False"
      },
      {
        "id": "4.3",
        "type": "true_false",
        "text": "Carla works in marketing.",
        "correct": "True"
      },
      {
        "id": "4.4",
        "type": "true_false",
        "text": "Peter plans events for new products.",
        "correct": "True"
      },
      {
        "id": "4.5",
        "type": "true_false",
        "text": "Carla is Brazilian.",
        "correct": "False"
      },
      {
        "id": "4.6",
        "type": "true_false",
        "text": "Peter started his job five years ago.",
        "correct": "False"
      }
    ]
  }
]
           
# Путь к файлу с балансами
BALANCE_FILE = 'balance.json'

# Загрузка баланса из файла
def load_balance():
    if os.path.exists(BALANCE_FILE):
        with open(BALANCE_FILE, 'r') as f:
            return json.load(f)
    else:
        return {}

# Сохранение баланса в файл
def save_balance(balance):
    with open(BALANCE_FILE, 'w') as f:
        json.dump(balance, f)
        
@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    balance_data = load_balance()

    # Преобразуем в список [(имя, баланс)] и сортируем по убыванию монет
    sorted_balances = sorted(balance_data.items(), key=lambda x: x[1], reverse=True)

    # ТОП-3 и остальные
    top_3 = sorted_balances[:3]  # Берем только 3 лучших
    others = sorted_balances[3:]  # Остальные

    leaderboard = {
        "top_3": [{"name": user, "coins": coins} for user, coins in top_3],
        "others": [{"name": user, "coins": coins} for user, coins in others]
    }

    return jsonify(leaderboard)
    
@socketio.on('tempBanUser')
def handle_temp_ban(data):
    username = data.get('username')
    duration = data.get('duration')
    # Эмиттируем событие обратно клиенту с именем пользователя и длительностью
    socketio.emit('tempBanUser', {'username': username, 'duration': duration})
    
@socketio.on('unblockUser')
def handle_unblock_user(data):
    username = data.get('username')
    # Эмиттируем событие обратно клиенту с именем пользователя
    socketio.emit('unblockUser', {'username': username})

@socketio.on('unblockUserRequest')
def handle_unblock(data):
    print("Unblock request received.")
    # Если нужно отправить событие всем клиентам, можно использовать аргумент room='all' 
    # или вручную перебрать sid-ы, но в большинстве случаев достаточно обычного emit:
    socketio.emit('unblockUser', {})  # отправляем всем подключенным клиентам


# Получение баланса для пользователя
@socketio.on('get_balance')
def get_balance(username):
    balance = load_balance()
    if username in balance:
        emit('balance', {'success': True, 'coins': balance[username]})
    else:
        emit('balance', {'success': False, 'message': 'User not found'})

@socketio.on('add_coins')
def add_coins(data):
    username = data['username']
    coins = data['coins']
    balance = load_balance()
    
    # Если пользователя нет в файле, создаем запись с 0 монетами
    if username not in balance:
        balance[username] = 0
    
    balance[username] += coins
    
    save_balance(balance)  # Сохраняем обновленный баланс
    
    # Отправляем обновленный баланс всем клиентам
    emit('coins_added', {'success': True, 'username': username, 'coins': balance[username]}, broadcast=True)
    
@app.route('/add_coins', methods=['POST'])
def add_coins_api():
    try:
        data = request.get_json()
        username = data.get("username")
        coins = data.get("coins", 0)

        if not username or not isinstance(coins, int) or coins <= 0:
            return jsonify({"error": "Invalid data"}), 400

        balance = load_balance()
        balance[username] = balance.get(username, 0) + coins
        save_balance(balance)

        # Отправляем обновленный баланс через WebSocket
        socketio.emit('coins_added', {'success': True, 'username': username, 'coins': balance[username]})

        return jsonify({"success": True, "username": username, "coins": balance[username]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@socketio.on('pay_for_ban_reduction')
def pay_for_ban_reduction(data):
    username = data['username']
    count_blocks = data['countBlocks']
    cost_per_violation = 100  # 100 монет за одно нарушение

    balance = load_balance()

    # Проверяем, есть ли у пользователя достаточно монет
    if username in balance and balance[username] >= cost_per_violation:
        # Списываем 100 монет за одно нарушение
        balance[username] -= cost_per_violation
        save_balance(balance)

        # Уменьшаем количество нарушений (countBlocks) на 1
        new_count_blocks = max(count_blocks - 1, 0)

        # Отправляем обновленное количество нарушений обратно на клиент
        emit('ban_reduction_success', {'success': True, 'new_count_blocks': new_count_blocks, 'coins': balance[username]})
    else:
        emit('ban_reduction_failed', {'success': False, 'message': 'Not enough coins'})

@app.route('/ping', methods=['GET'])
def ping():
    return '', 204  # Возвращает пустой успешный ответ

@app.route('/create_exam', methods=['POST'])
def create_exam():
    try:
        data = request.get_json()
        questions = data.get('questions', [])

        if not questions:
            return jsonify({"error": "No questions provided"}), 400

        # Set the exam start time and store duration
        #exam_start_time = time.time()
        global exam_start_time
        #exam_start_time = None  # Track the time when exam starts, comment this line if not needed

        # Store questions
        exam_questions.clear()
        #exam_passed.clear()
        
        for question in questions:
            question_data = {
                "id": question['id'],
                "text": question['text'],
                "type": question['type'],
                "correct": question['correct']
            }

            if question['type'] == 'multiple_choice' and 'options' in question:
                question_data["options"] = question['options']

            exam_questions.append(question_data)

        return jsonify({"success": True, "exam_duration": exam_duration})

    except Exception as e:
        app.logger.error(f"Error occurred in create_exam: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
        
@app.route('/create_homework_exam', methods=['POST'])
def create_homework_exam():
    try:
        data = request.get_json()
        questions = data.get('questions', [])

        if not questions:
            return jsonify({"error": "No questions provided"}), 400

        exam_questions.clear()

        for q in questions:
            question_data = {
                "id": q["id"],
                "text": q["text"],
                "type": q["type"]
            }

            if "audio" in q:
                question_data["audio"] = q["audio"]

            if "images" in q:
                question_data["images"] = q["images"]

            # If it has subquestions, add them
            if "subquestions" in q:
                question_data["subquestions"] = q["subquestions"]
            else:
                # Otherwise, must have correct + options if applicable
                question_data["correct"] = q["correct"]
                if q["type"] == "multiple_choice" and "options" in q:
                    question_data["options"] = q["options"]

            exam_questions.append(question_data)

        return jsonify({"success": True})

    except Exception as e:
        app.logger.error(f"Error in create_homework_exam: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/get_homework_questions', methods=['GET'])
def get_homework_questions():
    username = request.args.get('username')  # you can still log or ignore this
    if not exam_questions:
        return jsonify({"error": "No questions available"}), 404

    # Always return current questions
    return jsonify({"questions": exam_questions})


# Helper function to save homework submission data
def save_homework_submission(result):
    try:
        # Load existing homework submissions
        try:
            with open('done_homework.json', 'r') as file:
                done_homework = json.load(file)
        except FileNotFoundError:
            done_homework = []

        # Append new result to done_homework list
        done_homework.append(result)

        # Save the updated data back to the JSON file
        with open('done_homework.json', 'w') as file:
            json.dump(done_homework, file, indent=4)

    except Exception as e:
        app.logger.error(f"Error saving homework submission: {e}")
        raise  # Re-raise the exception so it can be handled later

@app.route('/submit_homework', methods=['POST'])
def submit_homework():
    try:
        # Получаем данные с клиента
        data = request.get_json()
        answers = data.get("answers")
        username = data.get("username")
        unit = data.get("unit")

        if not answers or not username:
            return jsonify({"error": "Missing data"}), 400

        # Проверка, что вопросный банк существует
        if not exam_questions:
            return jsonify({"error": "No homework exam created"}), 404

        # Загружаем предыдущие результаты, если они есть
        try:
            with open('done_homework.json', 'r') as file:
                done_homework = json.load(file)
        except FileNotFoundError:
            done_homework = []

        # Проверяем, сдавал ли уже пользователь экзамен для выбранного юнита
        for record in done_homework:
            if record["username"] == username and record["unit"] == unit:
                return jsonify({"error": "You have already submitted homework for this unit"}), 403

        correct = 0
        incorrect = 0
        skipped = 0
        results = []

        # Обработка вопросов и под-вопросов
        for question in exam_questions:
            if "subquestions" in question:
                # Обрабатываем под-вопросы
                for subq in question["subquestions"]:
                    subq_id = f"q{subq['id']}"
                    answer = answers.get(subq_id)

                    if not answer or answer.strip() == "":
                        skipped += 1
                        results.append({
                            "question_type": subq["type"],
                            "question_id": subq["id"],
                            "question": subq["text"],
                            "user_answer": answer,
                            "correct_answer": subq["correct"],
                            "is_correct": False
                        })
                        continue

                    is_correct = answer.strip().lower() == subq["correct"].strip().lower()
                    if is_correct:
                        correct += 1
                    else:
                        incorrect += 1

                    results.append({
                        "question_type": subq["type"],
                        "question_id": subq["id"],
                        "question": subq["text"],
                        "user_answer": answer,
                        "correct_answer": subq["correct"],
                        "is_correct": is_correct
                    })
            else:
                # Обработка обычных вопросов без под-вопросов
                question_id = f"q{question['id']}"
                answer = answers.get(question_id)

                if not answer or answer.strip() == "":
                    skipped += 1
                    results.append({
                        "question_type": question["type"],
                        "question_id": question["id"],
                        "question": question["text"],
                        "user_answer": answer,
                        "correct_answer": question["correct"],
                        "is_correct": False
                    })
                    continue

                is_correct = answer.strip().lower() == question["correct"].strip().lower()
                if is_correct:
                    correct += 1
                else:
                    incorrect += 1

                results.append({
                    "question_type": question["type"],
                    "question_id": question["id"],
                    "question": question["text"],
                    "user_answer": answer,
                    "correct_answer": question["correct"],
                    "is_correct": is_correct
                })

        # Подсчитываем общее количество вопросов
        total_questions = sum(
            len(question["subquestions"]) if "subquestions" in question else 1
            for question in exam_questions
        )
        correct_percentage = (correct / total_questions) * 100 if total_questions > 0 else 0
        coins = 15 if correct_percentage >= 80 else 0

        # Сохраняем результаты
        time_finished = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        done_homework.append({
            "username": username,
            "unit": unit,
            "correct": correct,
            "incorrect": incorrect,
            "skipped": skipped,
            "total_questions": total_questions,
            "correct_percentage": correct_percentage,
            "coins": coins,
            "time_finished": time_finished,
            "results": results
        })

        # Сохраняем обновленные данные
        with open('done_homework.json', 'w') as file:
            json.dump(done_homework, file, indent=4)

        return jsonify({
            "correct": correct,
            "incorrect": incorrect,
            "skipped": skipped,
            "total_questions": total_questions,
            "correct_percentage": correct_percentage,
            "coins": coins,
            "time_finished": time_finished
        })

    except Exception as e:
        app.logger.error(f"Error in submit_homework: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/check_homework_status')
def check_homework_status():
    username = request.args.get('username')
    unit = request.args.get('unit')

    if not username or not unit:
        return jsonify({"error": "Missing 'username' or 'unit' parameter"}), 400

    try:
        unit = int(unit)
    except ValueError:
        return jsonify({"error": "'unit' must be a number"}), 400

    file_path = 'done_homework.json'
    if not os.path.exists(file_path):
        return jsonify({"error": "Data file not found"}), 500

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Ищем по имени пользователя и юниту
    for entry in data:
        if entry.get('username') == username and entry.get('unit') == unit:
            return jsonify({"isCompleted": True})

    return jsonify({"isCompleted": False})

@socketio.on('exam_started')
def handle_exam_started():
    global exam_started
    exam_started = True
    emit('exam_started', {'message': 'Exam has started'}) 
    
@socketio.on('new_notification')
def handle_new_notification():
    emit('exam_started', {'message': 'New Notification'}) 

UPLOAD_FOLDER_SECTION = 'data/upload-section'
ALLOWED_EXTENSIONS_SECTION = {'zip', 'jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi'}

app.config['UPLOAD_FOLDER_SECTION'] = UPLOAD_FOLDER_SECTION

def allowed_file_section(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS_SECTION


@app.route('/upload-section', methods=['POST'])
def upload_section():
    if 'username' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    username = session['username']
    user_folder = os.path.join(app.config['UPLOAD_FOLDER_SECTION'], username, 'files')
    os.makedirs(user_folder, exist_ok=True)

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if allowed_file_section(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(user_folder, filename)
        file.save(file_path)
        return jsonify({"message": "File uploaded successfully"}), 200
    else:
        return jsonify({"error": "File type not allowed"}), 400



@app.route('/api/start-exam', methods=['POST'])
def start_exam():
    global exam_start_time, exam_end_time, exam_passed

    # Время начала экзамена
    exam_start_time = time.time()

    # Рассчитываем время окончания экзамена + 10 секунд
    exam_end_time = exam_start_time + exam_duration + 10  

    # Очищаем список пользователей, которые прошли экзамен
    exam_passed.clear()

    # Очищаем файл с результатами экзамена
    try:
        with open('exam_results.json', 'w') as f:
            json.dump({}, f)  # или [] в зависимости от структуры файла
    except Exception as e:
        return jsonify({"error": f"Failed to clear exam_results.json: {str(e)}"}), 500

    # Отправляем сообщение о старте экзамена
    socketio.emit('exam_started', {'message': 'Exam has started'})

    return jsonify({"message": "Exam has started and the passed list is cleared."}), 200

    
@socketio.on('exam_ended')
def handle_exam_ended():
    global exam_started
    exam_started = False
    emit('exam_ended', {'message': 'Exam has ended, settings have been reset.'})

@app.route('/api/end-exam', methods=['POST'])
def end_exam():
    global exam_start_time, exam_end_time, exam_started, exam_passed

    # Сброс переменных экзамена к заводским настройкам
    exam_start_time = None
    exam_end_time = None
    exam_started = False

    # Очищаем список пользователей, которые прошли экзамен
    exam_passed.clear()

    # Отправляем сообщение о завершении экзамена
    socketio.emit('exam_ended', {'message': 'Exam has ended and settings have been reset to factory defaults.'})

    return jsonify({"message": "Exam ended and settings reset."}), 200

@app.route('/get_remaining_time', methods=['GET'])
def get_remaining_time():
    if exam_start_time is None:
        return jsonify({"error": "Exam has not been started yet."}), 400

    # Calculate how much time has passed
    time_elapsed = time.time() - exam_start_time
    remaining_time = max(0, exam_duration - time_elapsed)  # Ensure no negative time

    return jsonify({"remaining_time": remaining_time})


def calculate_score(user_answers):
    correct_count = 0
    for question_id, user_answer in user_answers.items():
        # Поиск вопроса по ID
        question = next((q for q in exam_questions if q["id"] == question_id), None)
        
        # Если вопрос найден и ответ совпадает
        if question and user_answer == question["correct"]:
            correct_count += 1

    return (correct_count / len(exam_questions)) * 100 if exam_questions else 0


@app.route('/get_exam_questions_result', methods=['GET'])
def get_exam_questions_result():

    return jsonify({"questions": exam_questions})

@app.route('/get_exam_questions', methods=['GET'])
def get_exam_questions():
    time.sleep(1)

    username = request.args.get("username")  # Получаем имя пользователя из запроса

    if username in exam_passed:
        return jsonify({"error": "You have already passed the exam."}), 403  # Ошибка для уже прошедших

    if not exam_questions:
        return jsonify({"error": "No upcoming exams."}), 404

    if exam_start_time is None:
        return jsonify({"error": "Exam has not started yet."}), 403  # Ошибка, если экзамен ещё не начался

    current_time = time.time()
    exam_end_time = exam_start_time + exam_duration

    if current_time > exam_end_time:
        return jsonify({"error": "Exam time has expired."}), 403  # Ошибка, если время истекло

    return jsonify({"questions": exam_questions})

@app.route('/api/get_exam_results', methods=['GET'])
def get_exam_results():
    try:
        time.sleep(2)
        # Проверяем, существует ли файл с результатами
        if not os.path.exists('exam_results.json'):
            return jsonify({"error": "No exam results found"}), 404

        # Открываем и читаем файл с результатами
        with open('exam_results.json', 'r') as f:
            exam_results = json.load(f)

        # Возвращаем все данные в формате JSON
        return jsonify(exam_results)

    except Exception as e:
        app.logger.error(f"Error in get_exam_results: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/submit_exam', methods=['POST'])
def submit_exam():
    try:
        # Проверка на истечение времени экзамена
        current_time = time.time()  # Получаем текущее время
        if current_time > exam_end_time:
            return jsonify({"error": "Exam time has expired."}), 403  # Ошибка, если время истекло

        data = request.get_json(silent=True)
        answers = data.get("answers")
        username = data.get("username")

        if not username:
            return jsonify({"error": "Missing data"}), 400

        if username in exam_passed:
            return jsonify({"error": "You have already passed the exam."}), 403

        correct = 0
        incorrect = 0
        skipped = 0
        results = []

        # Обработка вопросов и под-вопросов
        for question in exam_questions:
            if "subquestions" in question:
                # Обрабатываем только под-вопросы, основной текст не считается
                for subq in question["subquestions"]:
                    subq_id = f"q{subq['id']}"
                    answer = answers.get(subq_id)
                    if not answer or answer.strip() == "":
                        skipped += 1
                        results.append({
                            "question_type": subq["type"],
                            "question_id": subq["id"],
                            "question": subq["text"],
                            "user_answer": answer,
                            "correct_answer": subq["correct"],
                            "is_correct": False
                        })
                        continue

                    is_correct = answer.strip().lower() == subq["correct"].strip().lower()
                    if is_correct:
                        correct += 1
                    else:
                        incorrect += 1

                    results.append({
                        "question_type": subq["type"],
                        "question_id": subq["id"],
                        "question": subq["text"],
                        "user_answer": answer,
                        "correct_answer": subq["correct"],
                        "is_correct": is_correct
                    })
            else:
                # Обработка обычных вопросов (без под-вопросов)
                if 'id' not in question:
                    app.logger.error(f"Missing 'id' in question: {question}")
                    continue

                question_id = f"q{question['id']}"
                answer = answers.get(question_id)

                if not answer or answer.strip() == "":
                    skipped += 1
                    results.append({
                        "question_type": question["type"],
                        "question_id": question["id"],
                        "question": question["text"],
                        "user_answer": answer,
                        "correct_answer": question["correct"],
                        "is_correct": False
                    })
                    continue

                is_correct = answer.strip().lower() == question["correct"].strip().lower()
                if is_correct:
                    correct += 1
                else:
                    incorrect += 1

                results.append({
                    "question_type": question["type"],
                    "question_id": question["id"],
                    "question": question["text"],
                    "user_answer": answer,
                    "correct_answer": question["correct"],
                    "is_correct": is_correct
                })

        # Подсчитываем общее количество вопросов:
        # Если у вопроса есть под-вопросы, считаем только их, иначе считаем сам вопрос.
        total_questions = sum(
            len(question["subquestions"]) if "subquestions" in question else 1
            for question in exam_questions
        )
        correct_percentage = (correct / total_questions) * 100 if total_questions > 0 else 0
        coins = 15 if correct_percentage >= 80 else 0 

        exam_passed.append(username)
        time_finished = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Сохраняем результаты в файл
        exam_results = {}
        if os.path.exists('exam_results.json'):
            with open('exam_results.json', 'r') as f:
                exam_results = json.load(f)

        exam_results[username] = {
            "correct": correct,
            "incorrect": incorrect,
            "skipped": skipped,
            "total_questions": total_questions,
            "correct_percentage": correct_percentage,
            "rewarded": coins > 0,
            "coins": coins,
            "time_finished": time_finished,
            "results": results
        }

        with open('exam_results.json', 'w') as f:
            json.dump(exam_results, f, indent=4)

        return jsonify({
            "correct": correct,
            "incorrect": incorrect,
            "skipped": skipped,
            "total_questions": total_questions,
            "correct_percentage": correct_percentage,
            "rewarded": coins > 0,
            "time_finished": time_finished,
            "coins": coins
        })

    except Exception as e:
        app.logger.error(f"Error in submit_exam: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@socketio.on('submitted_exam')
def handle_submitted_exam():
    emit('update-results', broadcast=True)  # broadcast=True => всем


@app.route("/app")
def app_remake():
    username = session.get('username')
    if not username or username not in active_sessions:
        return redirect('/login')
    return render_template("app.html")
    
@app.route("/chatCRM")
def crm():
    return render_template("chatCRM.html")
    
@app.route("/CRM-platform")
def crm_system():
    return render_template("CRM-platform.html")

@app.route("/release-update", methods=["POST"])
def release_update():
    global current_version

    # Разбиваем текущую версию на дату и номер версии
    date, version = current_version.split("-v")
    try:
        # Преобразуем номер версии в целое число и увеличиваем на 1
        next_version = f"{date}-v{int(version) + 1}"
    except ValueError:
        # Если произошла ошибка при преобразовании версии, отправляем ошибку
        return jsonify({"error": "Invalid version format"}), 400

    # Обновляем текущую версию
    current_version = next_version

    # Уведомляем всех подключённых клиентов об обновлении
    socketio.emit("updateReleased", {"version": current_version})  # Убираем to='all'

    # Возвращаем успешный ответ с новой версией
    return jsonify({"success": True, "version": current_version})

@app.route('/')
def login():
    return render_template('loginv2.html')
    
# File to store banned users
BANNED_USERS_FILE = 'banned_users.json'

def save_banned_users(banned_users):
    with open(BANNED_USERS_FILE, 'w') as f:
        json.dump(banned_users, f, indent=2)

def load_banned_users():
    if os.path.exists(BANNED_USERS_FILE):
        with open(BANNED_USERS_FILE, 'r') as f:
            try:
                banned_users = json.load(f)
            except json.JSONDecodeError:
                print("Error reading banned_users.json — invalid JSON format")
                return {}

            current_time = datetime.now()
            users_to_remove = []
            for username, data in banned_users.items():
                try:
                    ban_end = datetime.fromisoformat(data['ban_end_date'])
                    if current_time > ban_end:
                        users_to_remove.append(username)
                except Exception as e:
                    print(f"Error processing ban end date for user {username}: {e}")

            for username in users_to_remove:
                del banned_users[username]

            if users_to_remove:
                save_banned_users(banned_users)

            return banned_users
    return {}

@app.route('/ban-user/<username>', methods=['POST'])
def ban_user(username):
    banned_users = load_banned_users()
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'message': 'No JSON data provided', 'status': 'error'}), 400
        
        duration_days = int(data.get('duration_days', 7))  # Default 7 days
        reason = data.get('reason', 'No reason provided')
        offensive_item = data.get('offensive_item')
        
        ban_end_date = datetime.now() + timedelta(days=duration_days)
        
        banned_users[username] = {
            'ban_end_date': ban_end_date.isoformat(),
            'reason': reason,
            'banned_at': datetime.now().isoformat(),
            'offensive_item': offensive_item
        }
        
        save_banned_users(banned_users)

        # Удаляем все активные сессии пользователя из active_sessions
        if username in active_sessions:
            del active_sessions[username]

        # Если текущий запрос от забаненного пользователя, удаляем его сессию
        if 'username' in session and session['username'] == username:
            session.pop('username', None)

        return jsonify({'message': f'User {username} banned until {ban_end_date.isoformat()}', 'status': 'success'}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to ban user: {str(e)}', 'status': 'error'}), 400


# Get ban details for a user
@app.route('/ban-details/<username>', methods=['GET'])
def ban_details(username):
    banned_users = load_banned_users()
    
    if username in banned_users:
        details = banned_users[username]
        
        # Format dates into human-readable strings
        def format_date(date_str):
            try:
                dt = datetime.fromisoformat(date_str)
                return dt.strftime('%B %d, %Y at %I:%M %p')
            except Exception:
                return date_str  # fallback to original if parsing fails
        
        return jsonify({
            'username': username,
            'ban_end_date': format_date(details['ban_end_date']),
            'reason': details['reason'],
            'banned_at': format_date(details['banned_at']),
            'offensive_item': details.get('offensive_item')
        }), 200
    
    return jsonify({'message': f'User {username} is not banned', 'status': 'error'}), 404
    
@app.route('/banned-users', methods=['GET'])
def get_banned_users():
    banned_users = load_banned_users()
    return jsonify({
        'status': 'success',
        'users': [
            {
                'username': username,
                'ban_end_date': details['ban_end_date'],
                'reason': details['reason'],
                'banned_at': details['banned_at'],
                'offensive_item': details.get('offensive_item')
            } for username, details in banned_users.items()
        ]
    }), 200

# Reactivate a banned user
@app.route('/banned-user-reactivate/<username>', methods=['POST'])
def reactivate_user(username):
    banned_users = load_banned_users()
    
    if username in banned_users:
        del banned_users[username]
        save_banned_users(banned_users)
        return jsonify({'message': f'User {username} reactivated', 'status': 'success'}), 200
    return jsonify({'message': f'User {username} is not banned', 'status': 'error'}), 404


from device_detector import DeviceDetector

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'terminatorkashey@gmail.com'
app.config['MAIL_PASSWORD'] = 'nhqi etio crcy xquk'  # Вставь App Password сюда
app.config['MAIL_DEFAULT_SENDER'] = 'terminatorkashey@gmail.com'

mail = Mail(app)


# Генерация 6-значного кода
def generate_code():
    return str(random.randint(100000, 999999))

def get_email_by_username(username):
    with open("data/users-settings.json", "r") as f:
        data = json.load(f)
    return data.get(username)

def mask_email(email):
    local, domain = email.split("@")
    return f"{local[0]}{'*'*(len(local)-2)}{local[-1]}@{domain}"


# 🔹 Отправка 2FA кода
@app.route("/send-2fa-email", methods=["POST"])
def send_2fa_email():
    data = request.json
    username = data.get("username")
    email = get_email_by_username(username)

    session["2fa_user"] = username  # ✅ Всегда устанавливаем пользователя

    if not email:
        return jsonify({"skip_2fa": True})  # ✅ Пропустить 2FA, если нет email

    code = str(random.randint(100000, 999999))
    session["2fa_code"] = code
    session["2fa_expire"] = time.time() + 300  # 5 минут

    msg = Message("Your OTP Code", recipients=[email])
    msg.body = f"Your one-time password is: {code}"
    mail.send(msg)

    return jsonify({"message": "OTP sent", "masked_email": mask_email(email)})




# 🔹 Проверка 2FA кода
@app.route("/verify-2fa-code", methods=["POST"])
def verify_2fa_code():
    data = request.json
    input_code = data.get("code")
    username = session.get("2fa_user")
    correct_code = session.get("2fa_code")
    expire_time = session.get("2fa_expire")

    if not username:
        return jsonify({"error": "No 2FA session"}), 400

    # Проверка: если у пользователя нет email или пароль == "111111", пропустить 2FA
    email = get_email_by_username(username)
    temp_password = request.cookies.get("tempPassword") or "unknown"

    if not email or temp_password == "111111":
        session["username"] = username
        session.pop("2fa_code", None)
        session.pop("2fa_user", None)
        session.pop("2fa_expire", None)
        return jsonify({"success": True})

    # Стандартная проверка
    if not correct_code or not expire_time:
        return jsonify({"error": "Invalid 2FA session"}), 400

    if time.time() > expire_time:
        return jsonify({"error": "Code expired"}), 401

    if input_code == correct_code:
        session.pop("2fa_code", None)
        session.pop("2fa_user", None)
        session.pop("2fa_expire", None)
        session["username"] = username
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Invalid code"}), 401



@app.route('/login', methods=['GET', 'POST'])
def handle_login():
    banned_users = load_banned_users()
    current_time = datetime.now()

    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username') if data else None
        password = data.get('password') if data else None

        if not username or not password:
            return render_template('loginv2.html', error="Please provide username and password.")

        if username in banned_users:
            ban_end_date = datetime.fromisoformat(banned_users[username]['ban_end_date'])
            banned_at_dt = datetime.fromisoformat(banned_users[username]['banned_at'])

            ban_notice = {
                'title': f'Banned for {int((ban_end_date - banned_at_dt).days)} Day{"s" if (ban_end_date - banned_at_dt).days > 1 else ""}',
                'reviewed_date': banned_at_dt.strftime('%Y-%m-%d %H:%M:%S'),
                'reason': banned_users[username]['reason'],
                'offensive_item': banned_users[username].get('offensive_item'),
                'expired': current_time > ban_end_date,
                'username': username
            }
            return render_template('loginv2.html', ban_notice=ban_notice)

        if username in loggedUsers and loggedUsers[username] == password:
            user_agent_str = request.headers.get('User-Agent', '')
            parsed_device = DeviceDetector(user_agent_str).parse()
            ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
            country = "Unknown"  # Simplified

            new_session_id = str(uuid.uuid4())
            device_info = {
                'Session-ID': new_session_id,
                'Timestamp': datetime.utcnow().isoformat(),
                'Login-Time': current_time.strftime('%Y-%m-%d %H:%M:%S'),
                'User-Agent': user_agent_str,
                'IP-Address': ip_address,
                'Country': country,
                'Language': request.headers.get('Accept-Language', ''),
                'Device-Type': parsed_device.device_type(),
                'Device-Brand': parsed_device.device_brand(),
                'Device-Model': parsed_device.device_model(),
                'OS': f"{parsed_device.os_name()} {parsed_device.os_version()}",
                'Browser': f"{parsed_device.client_name()} {parsed_device.client_version()}",
                'Is-New': True  # Mark as NEW
            }

            active_sessions.setdefault(username, []).append(device_info)

            session['username'] = username
            session['session_id'] = new_session_id  # <- this is crucial

            return '', 200
        else:
            return render_template('loginv2.html', error="Invalid username or password")

    return render_template('loginv2.html')


@app.route('/sessions')
def get_sessions():
    sessions_data = []

    for devices in active_sessions.values():
        for device in devices:
            sessions_data.append({
                'deviceType': device.get('Device-Type', 'Unknown'),
                'deviceBrand': device.get('Device-Brand', 'Unknown'),
                'deviceModel': device.get('Device-Model', 'Unknown'),
                'os': device.get('OS', 'Unknown'),
                'browser': device.get('Browser', 'Unknown'),
                'ipAddress': device.get('IP-Address', 'Unknown'),
                'language': device.get('Language', 'Unknown'),
                'loginTime': device.get('Login-Time', 'Unknown'),
                'country': device.get('Country', 'Unknown'),
                'isCurrent': device.get('Is-Current', False)
            })

    return jsonify({'sessions': sessions_data})

def is_recent_session(login_time_str):
    try:
        login_time = datetime.fromisoformat(login_time_str)
        return datetime.utcnow() - login_time < timedelta(minutes=1)
    except:
        return False

@app.route('/api/sessions/')
def get_sessions_api():
    username = session.get('username')
    current_session_id = session.get('session_id')
    sessions_data = []

    if not username or username not in active_sessions:
        return jsonify({'sessions': []})

    now = datetime.utcnow()
    for device in active_sessions.get(username, []):
        session_id = device.get('Session-ID')
        login_time_str = device.get('Timestamp')

        # Определяем, новая ли сессия (<10 минут)
        try:
            login_time_dt = datetime.fromisoformat(login_time_str)
            is_new = (now - login_time_dt) < timedelta(minutes=10)
        except Exception:
            is_new = False

        is_current = (session_id == current_session_id)

        sessions_data.append({
            'username': username,
            'sessionId': session_id,
            'deviceType': device.get('Device-Type', 'Unknown'),
            'deviceBrand': device.get('Device-Brand', 'Unknown'),
            'deviceModel': device.get('Device-Model', 'Unknown'),
            'os': device.get('OS', 'Unknown'),
            'browser': device.get('Browser', 'Unknown'),
            'ipAddress': device.get('IP-Address', 'Unknown'),
            'language': device.get('Language', 'Unknown'),
            'country': device.get('Country', 'Unknown'),
            'loginTime': device.get('Login-Time', 'Unknown'),
            'isCurrent': is_current,
            'isNew': is_new
        })

    return jsonify({'sessions': sessions_data})


    
@app.route('/chat')
def chat():
    if 'username' not in session:
        return redirect(url_for('login'))
    
    # Load banned users
    banned_users = load_banned_users()
    
    # Check if the username is banned
    username = session.get('username', '')
    if username in banned_users:
        ban_end_date = datetime.fromisoformat(banned_users[username]['ban_end_date'])
        if ban_end_date > datetime.now():  # Check if ban is still active
            session.pop('username', None)  # Clear session for banned user
            return redirect(url_for('login'))
    
    return render_template('index.html', username=session.get('username', ''))
    
@app.route('/logout', methods=['POST'])
def logout():
    username = session.pop('username', None)
    user_agent = request.headers.get('User-Agent')

    if username and user_agent:
        if username in active_sessions:
            devices = active_sessions[username]
            device_to_remove = None

            for device_info in devices:
                if device_info.get('User-Agent') == user_agent:
                    device_to_remove = device_info
                    break

            if device_to_remove:
                devices.remove(device_to_remove)

            if not devices:
                del active_sessions[username]

    # Вместо редиректа возвращаем JSON
    return jsonify({"success": True, "message": "Logged out successfully"}), 200

@app.route('/api/terminate-session/<session_id>', methods=['DELETE'])
def terminate_session(session_id):
    username = session.get('username')
    current_session_id = session.get('session_id')

    if not username or username not in active_sessions:
        return jsonify({'error': 'Unauthorized'}), 401

    user_sessions = active_sessions[username]

    # Найти текущую сессию пользователя
    current_device = next((d for d in user_sessions if d.get('Session-ID') == current_session_id), None)

    if current_device:
        try:
            login_time = datetime.fromisoformat(current_device.get('Timestamp'))
            if datetime.utcnow() - login_time < timedelta(minutes=10):
                return jsonify({
                    'error': 'You cannot terminate any sessions while your account is marked as NEW. Wait 10 minutes after login to manage sessions.'
                }), 403
        except Exception:
            return jsonify({'error': 'Session verification failed.'}), 403

    # Найти сессию, которую хотят удалить
    target_device = next((d for d in user_sessions if d.get('Session-ID') == session_id), None)

    if not target_device:
        return jsonify({'error': 'Session not found'}), 404

    # Удалить выбранную сессию
    user_sessions.remove(target_device)
    socketio.emit('updated-sessions', {'username': username})
    return jsonify({'message': 'Session terminated'}), 200

    
@app.route('/api/verify-password', methods=['POST'])
def verify_password():
    username = session.get('username')
    if not username:
        return jsonify({'error': 'Not authenticated'}), 401

    data = request.get_json()
    input_password = data.get('password')

    user = loggedUsers.get(username)
    if not user or user != input_password:
        return jsonify({'error': 'Invalid password'}), 403

    return jsonify({'status': 'ok'}), 200
        
@app.route('/api/check-session', methods=['POST'])
def check_session():
    username = session.get('username')
    data = request.get_json()
    user_agent = data.get('userAgent')

    if not username or username not in active_sessions:
        return jsonify({'active': False})

    for device in active_sessions[username]:
        if device.get('User-Agent') == user_agent:
            return jsonify({'active': True})

    return jsonify({'active': False})


@app.route('/upload', methods=['POST'])
def upload():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        # Use original filename or generate a unique name without timestamp prefix
        filename = secure_filename(file.filename)  # Use original filename with security

        unique_filename = f"{uuid.uuid4()}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)

        # Broadcast file info
        message = {
            'type': 'file',
            'filename': file.filename,  # Use original filename for display
            'url': f'/uploads/{unique_filename}',  # Use unique filename for storage
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'username': session.get('username', 'Anonymous')
        }
        messages.append(message)
        socketio.emit('new_message', message)

        return jsonify({'success': True, 'url': f'/uploads/{unique_filename}'})

    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@socketio.on('connect')
def handle_connect():
    if 'username' in session:
        # Отправляем сохранённые сообщения
        emit('load_messages', messages)

        # Отправляем текущую версию
        emit('updateReleased', {'version': current_version})


@socketio.on('send_message')
def handle_message(data):
    if 'username' not in session:
        return

    message = {
        'type': 'text',
        'text': data['text'],
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'username': session.get('username', 'Anonymous')
    }
    messages.append(message)
    emit('new_message', message, broadcast=True)

@app.route('/change_password', methods=['POST'])
def change_password():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()

    current_password = (data.get('currentPassword') or '').strip()
    new_password = (data.get('newPassword') or '').strip()

    if not current_password or not new_password:
        return jsonify({'error': 'All fields are required.'}), 400

    username = session['username']

    if username not in loggedUsers:
        return jsonify({'error': 'User not found.'}), 404

    if loggedUsers[username] != current_password:
        return jsonify({'error': 'Incorrect current password'}), 403

    if current_password == new_password:
        return jsonify({'error': 'New password must be different from the current password'}), 400

    loggedUsers[username] = new_password

    try:
        with open(USER_DATA_FILE, 'w') as f:
            json.dump(loggedUsers, f)
    except Exception as e:
        return jsonify({'error': 'Failed to save new password.'}), 500

    return jsonify({'message': 'Password updated successfully'}), 200
    
DATA_FILE = 'historyofprogress.json'

def read_history_from_file():
    """Читаем историю из JSON-файла."""
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_history_to_file(data):
    """Записываем историю в JSON-файл."""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    


@app.route('/api/update-history', methods=['POST'])
def update_history():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    username = data.get("username")
    if not username:
        return jsonify({"error": "Username is required"}), 400

    # Загружаем всю историю
    all_data = read_history_from_file() or {}
    today_str = datetime.now().strftime('%Y-%m-%d')
    user_history = all_data.get(username, [])

    # Находим или создаём запись за сегодня
    existing_today = next((r for r in user_history if r.get("date") == today_str), None)
    if not existing_today:
        existing_today = {"date": today_str, "finalExam": 0, "today": 0}
        user_history.append(existing_today)

    # 1) Если пришёл averagePercent — ПЕРЕЗАПИСЫВАЕМ today
    if "averagePercent" in data:
        try:
            avg = float(data["averagePercent"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid averagePercent value"}), 400
        # today шкалируется из [0…100]% → [0…70]
        existing_today["today"] = min(avg / 100 * 70, 70)

    # 2) Инкрементальное обновление finalExam или today
    elif "updateType" in data and "progressIncrease" in data:
        update_type = data["updateType"]
        try:
            inc = float(data["progressIncrease"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid progressIncrease value"}), 400

        if update_type == "finalExam":
            existing_today["finalExam"] = min(existing_today.get("finalExam", 0) + inc, 30)
        elif update_type == "today":
            existing_today["today"] = min(existing_today.get("today", 0) + inc, 70)
        else:
            return jsonify({"error": "Invalid updateType. Must be 'finalExam' or 'today'."}), 400

    # 3) Полное обновление обоих полей finalExam и today
    else:
        try:
            fe = float(data.get("finalExam", existing_today.get("finalExam", 0)))
            td = float(data.get("today",     existing_today.get("today", 0)))
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid exam scores provided"}), 400

        existing_today["finalExam"] = min(fe, 30)
        existing_today["today"]     = min(td, 70)

    # Сохраняем и возвращаем результат
    all_data[username] = user_history
    write_history_to_file(all_data)
    return jsonify({"message": "History updated successfully"}), 200

@app.route('/api/get-history', methods=['GET'])
def get_history():
    username = request.args.get('username')
    if not username:
        return jsonify({"error": "Username not provided"}), 400

    all_data = read_history_from_file()
    user_history = all_data.get(username, [])
    return jsonify(user_history), 200

@app.route('/api/get-student-progress-history', methods=['GET'])
def get_student_progress_history():

    username = request.args.get('username')
    if not username:
        return jsonify({"error": "Username not provided"}), 400

    all_data = read_history_from_file()
    user_history = all_data.get(username, [])
    # Читаем данные из students_progress.json
    with open('students_progress.json', 'r', encoding='utf-8') as f:
        students_progress = json.load(f)
    initial_level = students_progress.get(username, {}).get("level", "Beginner")

    if not user_history:
        # Если у пользователя нет записей, используем уровень из students_progress.json
        return jsonify({
            username: {
                "level": initial_level,
                "finalExam": "0.00%",
                "today": "0.00%",
                "totalScore": "0.00%"
            }
        }), 200

    # Суммируем значения today и finalExam по всем записям
    total_today = sum(float(str(record.get("today", "0.00%")).rstrip('%')) for record in user_history if record.get("today"))
    total_final_exam = sum(float(str(record.get("finalExam", "0.00%")).rstrip('%')) for record in user_history if record.get("finalExam"))
    total_score = total_final_exam + total_today

    # Используем уровень из students_progress.json
    level = initial_level

    # Форматирование значений с двумя знаками после запятой и добавлением знака '%'
    final_exam_formatted = f"{total_final_exam:.2f}%"
    today_formatted = f"{total_today:.2f}%"
    total_score_formatted = f"{total_score:.2f}%"

    return jsonify({
        username: {
            "level": level,
            "finalExam": final_exam_formatted,
            "today": today_formatted,
            "totalScore": total_score_formatted
        }
    }), 200
    
@app.route('/vocabulary/<int:unit_number>', methods=['GET'])
def get_vocabulary(unit_number):
    base_path = os.path.join('static', 'Vocabulary', f'Unit {unit_number}')
    words_file = os.path.join(base_path, 'words.json')

    if not os.path.exists(words_file):
        return jsonify({"error": "Файл не найден"}), 404

    with open(words_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return jsonify(data)

exam_data = {}

# Path to the directory with random photos
PHOTO_DIR = os.path.join('static', 'exam-files', 'speaking')


@app.route('/api/start-speaking-exam/<ID>', methods=['POST'])
def start_speaking_exam(ID):
    print(f"\n📥 [LOG] Request to start exam for ID = {ID}")

    try:
        if ID in exam_data:
            print(f"⚠️ Exam already started for ID = {ID}")
            return jsonify({"message": "Exam already started"}), 400

        print(f"📁 Checking directory: {PHOTO_DIR}")
        if not os.path.isdir(PHOTO_DIR):
            print("❌ Photo directory does not exist.")
            return jsonify({"error": "Photo directory not found"}), 500

        files_in_dir = os.listdir(PHOTO_DIR)
        print(f"📂 Files in directory: {files_in_dir}")

        valid_photos = []
        allowed_extensions = ('.jpg', '.jpeg', '.png')

        for filename in files_in_dir:
            if filename.lower().endswith(allowed_extensions):
                photo_path = os.path.join(PHOTO_DIR, filename)
                base_name = os.path.splitext(filename)[0]
                json_filename = base_name + '.json'
                json_path = os.path.join(PHOTO_DIR, json_filename)

                if os.path.isfile(photo_path) and os.path.isfile(json_path):
                    valid_photos.append(filename)

        print(f"✅ Valid image+JSON pairs: {valid_photos}")

        if not valid_photos:
            print("❌ No valid image+JSON pairs found.")
            return jsonify({"error": "No valid photo/question pairs found"}), 500

        chosen_photo = random.choice(valid_photos)
        base_name = os.path.splitext(chosen_photo)[0]
        json_path = os.path.join(PHOTO_DIR, base_name + '.json')

        print(f"🎯 Selected image: {chosen_photo}")
        print(f"📄 Expected JSON file: {json_path}")

        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                questions = json.load(f)
            print(f"✅ Questions loaded: {questions}")
        except json.JSONDecodeError:
            print("❌ Invalid JSON format.")
            traceback.print_exc()
            return jsonify({"error": "Invalid JSON format in questions file"}), 500
        except Exception as e:
            print(f"❌ Error reading questions file: {str(e)}")
            traceback.print_exc()
            return jsonify({"error": f"Error reading questions file: {str(e)}"}), 500

        exam_data[ID] = {
            "status": "started",
            "photo": chosen_photo,
            "questions": questions
        }

        print(f"📝 Exam started for ID = {ID}")
        return jsonify({
            "message": "Exam started",
            "photo_assigned": chosen_photo,
            "questions": questions
        })

    except Exception as e:
        print(f"💥 Unexpected error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/api/get-status-sp-exam/<ID>', methods=['GET'])
def get_status_sp_exam(ID):
    """
    Возвращает статус экзамена для данного ID:
     - 'started', если запущен;
     - 'not started', если не найдена запись.
    """
    entry = exam_data.get(ID)
    if not entry:
        return jsonify({"status": "not started"})
    return jsonify({"status": entry["status"]})

@app.route('/api/get-sp-details/<ID>', methods=['GET'])
def get_sp_details(ID):
    """
    Возвращает детали экзамена:
     - Если запись для ID не существует — возвращает 404.
     - Если фото не назначено — возвращает 500.
     - Возвращает фото и вопросы в заголовках ответа.
    """
    entry = exam_data.get(ID)
    if not entry:
        return jsonify({"error": "Exam not started"}), 404

    photo_file = entry.get("photo")
    if not photo_file:
        return jsonify({"error": "Photo not assigned"}), 500

    questions_data = entry.get("questions", {})
    questions = questions_data.get("questions", [])  # Extract the array from the dict
    if not questions:
        return jsonify({"error": "No questions assigned"}), 500

    # Отправляем файл без кеширования
    response = make_response(
        send_from_directory(PHOTO_DIR, photo_file, as_attachment=False)
    )
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    print(f"Setting X-Questions header: {questions}")  # Debug log
    response.headers['X-Questions'] = json.dumps(questions, ensure_ascii=False)

    return response
    
@app.route('/api/speaking-exam-end/<ID>', methods=['POST'])
def speaking_exam_end(ID):
    """
    Завершает экзамен, сохраняет score (20,40,60,80 или 100) и выставляет статус = 'completed'
    """
    data = request.get_json() or {}
    score = data.get('score')
    if ID not in exam_data:
        return jsonify({"error": "Exam not started"}), 404
    if score not in (20, 40, 60, 80, 100):
        return jsonify({"error": "Invalid score"}), 400

    exam_data[ID]['status'] = 'completed'
    exam_data[ID]['score'] = score
    return jsonify({"message": "Exam ended", "score": score})
    
UPLOAD_DIR = os.path.join('static', 'speaking-files')
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.route('/api/upload-speaking/<ID>', methods=['POST'])
def upload_speaking(ID):
    if ID not in exam_data:
        return jsonify({"error": "Exam not started"}), 404

    file = request.files.get('file')
    if not file:
        return jsonify({"error": "No file provided"}), 400

    filename = f"{ID}.webm"
    path = os.path.join(UPLOAD_DIR, filename)
    file.save(path)

    # сохраняем путь или флаг, если нужно
    exam_data[ID]['audio'] = filename
    return jsonify({"message": "File uploaded"}), 200

@app.route('/api/get-score-sp-exam/<ID>', methods=['GET'])
def get_score_sp_exam(ID):
    entry = exam_data.get(ID)
    if not entry or 'score' not in entry:
        # если оценка ещё не назначена, вернём 0
        return jsonify({"score": 0})
    return jsonify({"score": entry['score']})
    
# Путь к файлу хранения долгов
DATA_FOLDER_DEBT_PROPOSAL = os.path.join(os.getcwd(), 'data', 'debtProposal')
STORAGE_FILE = os.path.join(DATA_FOLDER_DEBT_PROPOSAL, 'debts.json')    

def load_debts():
    if not os.path.exists(STORAGE_FILE):
        return {'next_id': 1, 'debts': []}
    with open(STORAGE_FILE) as f:
        return json.load(f)

def save_debts(store):
    os.makedirs(os.path.dirname(STORAGE_FILE), exist_ok=True)
    with open(STORAGE_FILE, 'w') as f:
        json.dump(store, f, indent=2)

@app.route('/api/debts/propose', methods=['POST'])
def propose_debt():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json or {}
    store = load_debts()
    debt = {
        'id': store['next_id'],
        'proposer': session['username'],
        'proposee': data.get('username'),
        'amount': data.get('amount', 0),
        'interest': data.get('interest', 0),
        'due_date': data.get('due_date'),
        'status': 'pending',
        'created_at': datetime.utcnow().isoformat()
    }
    store['debts'].append(debt)
    store['next_id'] += 1
    save_debts(store)
    # Сразу списываем сумму у предложившего
    add_transaction_internal(debt['proposer'], -debt['amount'], f'Debt proposed #{debt["id"]}')
    return jsonify({'id': debt['id'], 'status': debt['status']})

@app.route('/api/debts/<int:debt_id>/accept', methods=['POST'])
def accept_debt(debt_id):
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    store = load_debts()
    d = next((x for x in store['debts'] if x['id']==debt_id), None)
    if not d or d['proposee']!=session['username']:
        return jsonify({'error': 'Forbidden'}), 403
    d['status'] = 'accepted'
    save_debts(store)
    # Зачисление на счет proposee
    add_transaction_internal(d['proposee'], d['amount'], f'Loan accepted #{debt_id}')
    return jsonify({'status': d['status']})

@app.route('/api/debts/<int:debt_id>/decline', methods=['POST'])
def decline_debt(debt_id):
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    store = load_debts()
    d = next((x for x in store['debts'] if x['id']==debt_id), None)
    if not d or d['proposee']!=session['username']:
        return jsonify({'error': 'Forbidden'}), 403
    d['status'] = 'declined'
    save_debts(store)
    # Возврат средств к proposer
    add_transaction_internal(d['proposer'], d['amount'], f'Debt declined #{debt_id}')
    return jsonify({'status': d['status']})

@app.route('/api/debts/<int:debt_id>/repay', methods=['POST'])
def repay_debt(debt_id):
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    store = load_debts()
    d = next((x for x in store['debts'] if x['id'] == debt_id), None)

    if not d or session['username'] != d['proposee']:
        return jsonify({'error': 'Forbidden'}), 403

    try:
        due = datetime.fromisoformat(d['due_date'])
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
    except Exception:
        return jsonify({'error': 'Invalid due_date format'}), 400

    now = datetime.now(timezone.utc)
    overdue = now > due

    total = d['amount'] * (1 + (d['interest'] / 100 if overdue else 0))
    # Погашение долга
    add_transaction_internal(d['proposee'], -total, f'Repayment #{debt_id}')
    add_transaction_internal(d['proposer'], total, f'Repayment received #{debt_id}')
    d['status'] = 'repaid'
    save_debts(store)

    return jsonify({'status': d['status']})



@app.route('/api/debts', methods=['GET'])
def list_debts():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    store = load_debts()
    now = datetime.now(timezone.utc)
    updated = False

    for d in store['debts']:
        try:
            due_dt = datetime.fromisoformat(d['due_date'])
            if due_dt.tzinfo is None:
                due_dt = due_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        # Автоматическое отклонение просроченных "pending"
        if d['status'] == 'pending' and now > due_dt:
            d['status'] = 'declined'
            add_transaction_internal(d['proposer'], d['amount'], f'Debt auto-declined #{d["id"]}')
            updated = True
            continue

        # Автоматическое погашение просроченного "accepted"
        if d['status'] == 'accepted' and now > due_dt:
            try:
                interest_multiplier = 1 + (d['interest'] / 100)
                total_due = round(d['amount'] * interest_multiplier, 2)

                add_transaction_internal(
                    d['proposee'], -total_due,
                    f'Debt auto-repay to {d["proposer"]} (#{d["id"]})'
                )
                add_transaction_internal(
                    d['proposer'], total_due,
                    f'Debt repaid by {d["proposee"]} (#{d["id"]})'
                )
                d['status'] = 'repaid_automatically'  # 👈 Новый статус
                updated = True
            except Exception as e:
                print(f"[Auto-Repay Error] Debt #{d['id']}: {e}")
                continue

    if updated:
        save_debts(store)

    user = session['username']
    incoming, outgoing = [], []

    for d in store['debts']:
        try:
            due_dt = datetime.fromisoformat(d['due_date'])
            if due_dt.tzinfo is None:
                due_dt = due_dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        overdue = now > due_dt

        # 👇 Человеческий label
        if d['status'] == 'repaid_automatically':
            label = 'Repaid Automatically'
        else:
            label = d['status'].capitalize()

        if d['status'] in ('accepted', 'repaid_automatically'):
            total_due = round(d['amount'] * (1 + (d['interest'] / 100 if overdue else 0)), 2)
        else:
            total_due = d['amount']

        entry = {**d, 'label': label, 'total_due': total_due}
        if d['proposee'] == user:
            incoming.append(entry)
        if d['proposer'] == user:
            outgoing.append(entry)

    return jsonify({'incoming': incoming, 'outgoing': outgoing})

# Новые пути
BASE_TASKS_DIR = os.path.join('static', 'data', 'today')
RESULTS_DIR    = os.path.join('static', 'data', 'today_results')

def get_tasks_path(level: str, unit: str, title: str = None) -> str:
    """
    Если title указан — возвращает путь к файлу <title>.json,
    иначе — к manifest или списку всех задач.
    """
    base = os.path.join(BASE_TASKS_DIR, level, unit)
    if title:
        return os.path.join(base, f"{title}.json")
    return os.path.join(base, 'task_files.json')

def get_results_path(level: str, unit: str) -> str:
    safe = f"{level}_{unit}".replace('/', '_')
    return os.path.join(RESULTS_DIR, f"today_results_{safe}.json")

def load_tasks(level: str, unit: str, title: str = None):
    path = get_tasks_path(level, unit, title)
    if not os.path.isfile(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_results(level: str, unit: str) -> dict:
    path = get_results_path(level, unit)
    if os.path.isfile(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_results(level: str, unit: str, results: dict):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    path = get_results_path(level, unit)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=4)
        
def load_all_results(level: str) -> dict:
    """
    Aggregates results from all units for a given level.
    Returns a dictionary with usernames as keys and their aggregated results.
    """
    aggregated_results = {}
    base_dir = os.path.join(RESULTS_DIR)
    if not os.path.isdir(base_dir):
        return aggregated_results

    # Iterate through all files in RESULTS_DIR
    for fname in os.listdir(base_dir):
        if fname.startswith(f"today_results_{level}_") and fname.endswith('.json'):
            path = os.path.join(base_dir, fname)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    unit_results = json.load(f)
                    # Merge results into aggregated_results
                    for username, tasks in unit_results.items():
                        if username not in aggregated_results:
                            aggregated_results[username] = []
                        for task_name, task_data in tasks.items():
                            if task_data.get('submitted', False):
                                aggregated_results[username].append({
                                    'task_name': task_name,
                                    'percent': task_data['percent'],
                                    'unit': fname.replace(f'today_results_{level}_', '').replace('.json', '')
                                })
            except Exception as e:
                app.logger.error(f"Failed to load {path}: {e}")

    return aggregated_results


@app.route('/api/today/create', methods=['POST'])
def create_today():
    data      = request.get_json(force=True)
    level     = data.get('level')
    unit      = data.get('unit')
    questions = data.get('questions', [])

    if not level or not unit:
        return jsonify({"error": "Missing level or unit"}), 400
    if not isinstance(questions, list) or not questions:
        return jsonify({"error": "No questions provided"}), 400

    dest_dir = os.path.dirname(get_tasks_path(level, unit))
    os.makedirs(dest_dir, exist_ok=True)
    with open(get_tasks_path(level, unit), 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=4)

    return jsonify({"success": True}), 200


@app.route('/api/submit-tasks', methods=['POST'])
def submit_tasks():
    time.sleep(1)
    data     = request.get_json(force=True)
    level    = data.get('level')
    unit     = data.get('unit')
    title    = data.get('title')
    username = data.get('username')
    answers  = data.get('answers', {})

    # Валидация
    if not all([level, unit, title, username]):
        return jsonify({"error": "Missing required fields"}), 400
    if not isinstance(answers, dict):
        return jsonify({"error": "Invalid answers"}), 400

    # Загружаем вопросы
    tasks = load_tasks(level, unit, title)
    if tasks is None:
        return jsonify({"error": f"Task file '{title}.json' not found"}), 404

    # Загружаем/инициируем результаты
    all_results  = load_results(level, unit)
    user_results = all_results.setdefault(username, {})

    # Проверяем повторную отправку
    if user_results.get(title, {}).get('submitted'):
        return jsonify({"error": f"'{title}' already submitted"}), 403

    # Подсчёт
    correct = incorrect = skipped = 0
    details = []

    for q in tasks:
        items = q.get('subquestions', [q])
        for sub in items:
            qid = str(sub['id'])
            ans = answers.get(qid, '').strip()

            # Derive correct answer from text for select-options if not provided
            correct_answer = str(sub.get('correct', '')).strip()
            if sub.get('type') == 'select-options' and not correct_answer:
                match = re.search(r'\((.*?)\)', sub.get('text', ''))
                if match:
                    options = match.group(1).split('/')
                    correct_answer = next((opt.strip() for opt in options if '**' in opt), '').replace('**', '').strip()

            if not ans:
                skipped += 1
                is_corr = False
            else:
                is_corr = ans.lower() == correct_answer.lower()
                correct += int(is_corr)
                incorrect += int(not is_corr)

            details.append({
                "question_id":    sub['id'],
                "text":           sub.get('text', ''),
                "user_answer":    ans,
                "correct_answer": correct_answer,
                "is_correct":     is_corr
            })

    total   = len(details)
    percent = (correct / total * 100) if total else 0.0

    # Сохраняем результат
    record = {
        "submitted": True,
        "time":      datetime.now().isoformat(sep=' ', timespec='seconds'),
        "correct":   correct,
        "incorrect": incorrect,
        "skipped":   skipped,
        "total":     total,
        "percent":   percent,
        "details":   details
    }
    user_results[title] = record
    save_results(level, unit, all_results)

    # Список неверных с текстом вопроса
    incorrect_list = [
        {
            "q": detail["question_id"],
            "text": detail["text"],
            "user": detail["user_answer"],
            "correct": detail["correct_answer"]
        }
        for detail in details if not detail["is_correct"]
    ]

    # Награда
    reward_given = False
    if percent >= 80:
        reward_given = True
        try:
            add_tx_url = url_for('add_transaction', _external=True)
            resp = requests.post(add_tx_url, json={
                "username": username,
                "amount": 100,
                "description": f"Reward for completing '{title}' with {int(percent)}%"
            }, timeout=5)  # увеличенный таймаут
            resp.raise_for_status()
        except Exception:
            reward_given = False  # откатываем награду, если не сработало

    return jsonify({
        "title":          title,
        "correct":        correct,
        "incorrect":      incorrect,
        "skipped":        skipped,
        "total":          total,
        "percent":        percent,
        "reward_given":   reward_given,
        "incorrect_list": incorrect_list
    }), 200

@app.route('/api/get-results', methods=['GET'])
def get_results():
    level = request.args.get('level')
    unit  = request.args.get('unit')
    if not level or not unit:
        return jsonify({"error": "Missing level or unit"}), 400

    return jsonify(load_results(level, unit)), 200
    
@app.route('/api/get-results/today', methods=['GET'])
def get_results_today():
    level = request.args.get('level')
    if not level:
        return jsonify({"error": "Missing level"}), 400

    # Load and aggregate results for all units of the given level
    aggregated_results = load_all_results(level)
    
    # Calculate average percentage for each user
    result_summary = {}
    for username, tasks in aggregated_results.items():
        if tasks:  # Only include users with submitted tasks
            total_percent = sum(task['percent'] for task in tasks)
            task_count = len(tasks)
            result_summary[username] = {
                'average_percent': total_percent / task_count if task_count > 0 else 0,
                'tasks': tasks
            }

    return jsonify(result_summary), 200


@app.route('/api/get-today-questions', methods=['GET'])
def get_today_questions():
    level = request.args.get('level')
    unit  = request.args.get('unit')

    if not level or not unit:
        return jsonify({"error": "Missing level or unit"}), 400

    base_dir = os.path.join(BASE_TASKS_DIR, level, unit)
    if not os.path.isdir(base_dir):
        return jsonify({"error": "Tasks directory not found"}), 404

    today_tasks = []
    for fname in os.listdir(base_dir):
        print(f"📂 Found file: {fname}")

        if not fname.endswith('.json'):
            continue

        path = os.path.join(base_dir, fname)
        title = os.path.splitext(fname)[0]
        try:
            with open(path, 'r', encoding='utf-8') as f:
                questions = json.load(f)
            today_tasks.append({
                "title": title,
                "questions": questions
            })
        except Exception as e:
            print(f"❌ Failed to load file {fname}: {e}")

    if not today_tasks:
        return jsonify({"error": "No task files found in this unit"}), 404

    return jsonify({"today_tasks": today_tasks}), 200



CHAT_FILE = 'chats.json'
PRIVATE_UPLOAD_FOLDER = 'private_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'webm', 'mp3'}

app.config['PRIVATE_UPLOAD_FOLDER'] = PRIVATE_UPLOAD_FOLDER

# Убедимся, что папка и файл существуют
os.makedirs(PRIVATE_UPLOAD_FOLDER, exist_ok=True)
if not os.path.exists(CHAT_FILE):
    with open(CHAT_FILE, 'w') as f:
        json.dump({}, f)

# Вспомогательные функции
def get_room_id(user1, user2):
    return f"{min(user1, user2)}_{max(user1, user2)}"

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/private_uploads/<filename>')
def serve_private_upload(filename):
    return send_from_directory(app.config['PRIVATE_UPLOAD_FOLDER'], filename)

@app.route('/chat/<user1>/<user2>', methods=['GET'])
def get_chat(user1, user2):
    room_id = get_room_id(user1, user2)
    with open(CHAT_FILE, 'r') as f:
        chats = json.load(f)
    return jsonify(chats.get(room_id, []))

@app.route('/chat/send_media', methods=['POST'])
def send_media_file():
    sender = request.form.get('sender')
    receiver = request.form.get('receiver')
    file = request.files.get('file')

    if not (sender and receiver and file):
        return jsonify({'error': 'Missing sender, receiver or file'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    filename = secure_filename(f"{int(time.time())}_{file.filename}")
    filepath = os.path.join(app.config['PRIVATE_UPLOAD_FOLDER'], filename)
    file.save(filepath)

    return jsonify({'media_url': f"/private_uploads/{filename}"}), 200

@socketio.on('join_private')
def handle_join_private(data):
    sender = data['sender']
    receiver = data['receiver']
    room = get_room_id(sender, receiver)
    join_room(room)
    print(f"{sender} joined private room: {room}")

@socketio.on('send_private_message')
def handle_private_message(data):
    sender = data['sender']
    receiver = data['receiver']
    message = data.get('message', '')
    media_url = data.get('media_url', None)
    timestamp = datetime.utcnow().isoformat()

    room = get_room_id(sender, receiver)

    msg = {
        'sender': sender,
        'receiver': receiver,
        'message': message,
        'timestamp': timestamp,
        'read': False  # ← ДОБАВЬ ЭТУ СТРОКУ
    }

    if media_url:
        msg['media_url'] = media_url

    if os.path.exists(CHAT_FILE):
        with open(CHAT_FILE, 'r') as f:
            chats = json.load(f)
    else:
        chats = {}

    chats.setdefault(room, []).append(msg)

    with open(CHAT_FILE, 'w') as f:
        json.dump(chats, f, indent=2)

    emit('receive_private_message', msg, room=room, include_self=True)

    
@app.route('/chat/all')
def get_all_chats():
    try:
        with open(CHAT_FILE, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@socketio.on('join_all_private_rooms')
def join_all_rooms(data):
    username = data['username']
    with open(CHAT_FILE, 'r') as f:
        chats = json.load(f)

    for room_id in chats:
        if username in room_id:
            join_room(room_id)
            
@app.route('/chat/read/<user1>/<user2>', methods=['POST'])
def mark_messages_as_read(user1, user2):
    room_id = get_room_id(user1, user2)

    with open(CHAT_FILE, 'r') as f:
        chats = json.load(f)

    messages = chats.get(room_id, [])
    updated = False

    for msg in messages:
        if msg.get('receiver') == user1 and not msg.get('read'):
            msg['read'] = True
            updated = True

    if updated:
        with open(CHAT_FILE, 'w') as f:
            json.dump(chats, f, indent=2)

        socketio.emit('messages_read', {
            'reader': user1,
            'sender': user2
        }, room=get_room_id(user1, user2))

    return jsonify({'status': 'ok', 'updated': updated})
    
@app.route('/api/risk_ladder', methods=['POST'])
def risk_ladder():
    data = request.json
    username = data.get("username")
    level = data.get("level", 1)

    if not username:
        return jsonify({"error": "Username required for cosmic journey!"}), 400
    if not (1 <= level <= 7):
        return jsonify({"error": "Invalid star level!"}), 400

    ENTRY_COST = 3500
    RISK_LEVELS = {
        1: {"chance": 0.95, "reward": 800, "message": "Orbit achieved! Proceed or claim?"},
        2: {"chance": 0.80, "reward": 2000, "message": "Nebula crossed! Risk more?"},
        3: {"chance": 0.70, "reward": 3500, "message": "Star cluster reached! Continue?"},
        4: {"chance": 0.60, "reward": 6000, "message": "Galactic core in sight! Dare to go on?"},
        5: {"chance": 0.50, "reward": 10000, "message": "Black hole proximity! Risk or retreat?"},
        6: {"chance": 0.40, "reward": 20000, "message": "Cosmic vault unlocked! One last leap?"},
        7: {"chance": 0.30, "reward": 50000, "message": "Cosmic apex reached! Claim your treasure!"}
    }

    balances = load_balances()
    transactions = load_transactions()
    sessions = load_json("risk_ladder_sessions.json")

    balances.setdefault(username, 0.0)
    transactions.setdefault(username, [])
    sessions.setdefault(username, {"level": 0, "potential_reward": 0, "active": False})

    if level == 1:
        if balances[username] < ENTRY_COST:
            return jsonify({"error": "Not enough cosmic credits! Need 700 pts."}), 403
        balances[username] -= ENTRY_COST
        transactions[username].append({
            "id": str(uuid.uuid4()),
            "amount": -ENTRY_COST,
            "description": "🌌 Cosmic Ladder Entry",
            "time": (datetime.utcnow() + timedelta(hours=5)).isoformat(),
            "balance_before": balances[username] + ENTRY_COST,
            "can_cancel": False
        })
        sessions[username] = {"level": 1, "potential_reward": 0, "active": True}

    elif not sessions[username]["active"] or sessions[username]["level"] != level - 1:
        return jsonify({"error": "Invalid step or cosmic session expired."}), 400

    level_data = RISK_LEVELS.get(level)
    win = random.random() <= level_data["chance"]
    reward = level_data["reward"]

    if win:
        sessions[username]["level"] = level
        sessions[username]["potential_reward"] = reward
        store_json("risk_ladder_sessions.json", sessions)
        store_balances(balances)
        store_transactions(transactions)
        return jsonify({
            "result": "success",
            "level": level,
            "chance": level_data["chance"],
            "reward": reward,
            "message": level_data["message"]
        })
    else:
        sessions[username] = {"level": 0, "potential_reward": 0, "active": False}
        store_json("risk_ladder_sessions.json", sessions)
        store_balances(balances)
        store_transactions(transactions)
        return jsonify({
            "result": "fail",
            "level": level,
            "chance": level_data["chance"],
            "reward": 0,
            "message": "Cosmic collapse! All rewards lost in the void."
        })

@app.route('/api/risk_ladder_take', methods=['POST'])
def risk_ladder_take():
    data = request.json
    username = data.get("username")
    reward = data.get("reward")

    if not username or reward is None:
        return jsonify({"error": "Invalid cosmic data!"}), 400

    balances = load_balances()
    transactions = load_transactions()
    sessions = load_json("risk_ladder_sessions.json")

    session = sessions.get(username)
    if not session or not session.get("active"):
        return jsonify({"error": "No active cosmic session!"}), 400

    expected_reward = session.get("potential_reward", 0)
    if expected_reward != reward:
        return jsonify({"error": "Reward mismatch in the cosmos!"}), 400

    balance_before = balances.get(username, 0)
    balances[username] = balance_before + reward

    transactions[username].append({
        "id": str(uuid.uuid4()),
        "amount": reward,
        "description": "💫 Cosmic Treasure Claimed",
        "time": (datetime.utcnow() + timedelta(hours=5)).isoformat(),
        "balance_before": balance_before,
        "can_cancel": False
    })

    sessions[username] = {"level": 0, "potential_reward": 0, "active": False}

    store_balances(balances)
    store_transactions(transactions)
    store_json("risk_ladder_sessions.json", sessions)

    return jsonify({"success": True, "new_balance": balances[username]})

@app.route('/api/horror_event', methods=['POST'])
def horror_event():
    data = request.json
    username = data.get("username")
    level = data.get("level", 1)

    if not username:
        return jsonify({"error": "Who dares enter without a name?"}), 400
    if not (1 <= level <= 5):
        return jsonify({"error": "No such nightmare level exists."}), 400

    ENTRY_COST = 2500
    HORROR_LEVELS = {
        1: {"screamer": 0.90, "reward": 1300, "message": "A whisper in the dark... move forward?"},
        2: {"screamer": 0.75, "reward": 2500, "message": "You step on bones... still alive. Proceed?"},
        3: {"screamer": 0.60, "reward": 4000, "message": "Blood on the walls... almost there?"},
        4: {"screamer": 0.45, "reward": 7000, "message": "Voices call your name. One last room?"},
        5: {"screamer": 0.30, "reward": 15000, "message": "The Final Door creaks... Enter or flee?"}
    }

    balances = load_balances()
    sessions = load_json("horror_event_sessions.json")
    transactions = load_transactions()

    balances.setdefault(username, 0.0)
    transactions.setdefault(username, [])
    sessions.setdefault(username, {"level": 0, "potential_reward": 0, "active": False})

    if level == 1:
        if balances[username] < ENTRY_COST:
            return jsonify({"error": "Not enough points to enter the cursed house (1111 pts needed)."}), 403
        balances[username] -= ENTRY_COST
        transactions[username].append({
            "id": str(uuid.uuid4()),
            "amount": -ENTRY_COST,
            "description": "🩸 Entered Horror Games",
            "time": (datetime.utcnow() + timedelta(hours=5)).isoformat(),
            "balance_before": balances[username] + ENTRY_COST,
            "can_cancel": False
        })
        sessions[username] = {"level": 1, "potential_reward": 0, "active": True}

    elif not sessions[username]["active"] or sessions[username]["level"] != level - 1:
        return jsonify({"error": "You lost your way in the maze of madness."}), 400

    level_data = HORROR_LEVELS.get(level)
    survive = random.random() <= level_data["screamer"]
    reward = level_data["reward"]

    if survive:
        sessions[username]["level"] = level
        sessions[username]["potential_reward"] = reward
        store_json("horror_event_sessions.json", sessions)
        store_balances(balances)
        store_transactions(transactions)
        return jsonify({
            "result": "survived",
            "level": level,
            "chance": level_data["screamer"],
            "reward": reward,
            "message": level_data["message"]
        })
    else:
        sessions[username] = {"level": 0, "potential_reward": 0, "active": False}
        store_json("horror_event_sessions.json", sessions)
        store_balances(balances)
        store_transactions(transactions)
        return jsonify({
            "result": "screamer",
            "level": level,
            "reward": 0,
            "message": "Screams echo... and everything goes black. You lost all rewards."
        })

@app.route('/api/horror_event_take', methods=['POST'])
def horror_event_take():
    data = request.json
    username = data.get("username")
    reward = data.get("reward")

    if not username or reward is None:
        return jsonify({"error": "The shadows won't release unmarked souls."}), 400

    balances = load_balances()
    sessions = load_json("horror_event_sessions.json")
    transactions = load_transactions()

    session = sessions.get(username)
    if not session or not session.get("active"):
        return jsonify({"error": "No active horror session to escape from."}), 400

    expected_reward = session.get("potential_reward", 0)
    if expected_reward != reward:
        return jsonify({"error": "Greed consumes the mind — reward mismatch!"}), 400

    balance_before = balances.get(username, 0)
    balances[username] = balance_before + reward

    transactions[username].append({
        "id": str(uuid.uuid4()),
        "amount": reward,
        "description": "🎁 Escaped Horror with Reward",
        "time": (datetime.utcnow() + timedelta(hours=5)).isoformat(),
        "balance_before": balance_before,
        "can_cancel": False
    })

    sessions[username] = {"level": 0, "potential_reward": 0, "active": False}

    store_balances(balances)
    store_transactions(transactions)
    store_json("horror_event_sessions.json", sessions)

    return jsonify({"success": True, "new_balance": balances[username]})


STRIKES_FILE = 'data/strikes.json'

def load_strikes():
    if not os.path.exists(STRIKES_FILE):
        return {}
    with open(STRIKES_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def save_strikes(data):
    with open(STRIKES_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Список всех Units в порядке
Units = [
  "1.1","1.2","1.3","2.1","2.2","2.3","3.1","3.2","3.3",
  "4.1","4.2","4.3","5.1","5.2","5.3","6.1","6.2","6.3",
  "7.1","7.2","7.3","8.1","8.2","8.3","9.1","9.2","9.3",
  "10.1","10.2","10.3","11.1","11.2","11.3","12.1","12.2","12.3"
]

@app.route('/api/check-strike', methods=['POST'])
def check_strike():
    data = request.get_json(silent=True) or {}
    username        = data.get('username')
    current_unit    = data.get('currentUnit')
    unit_percent    = data.get('unitPercent')
    submitted_count = data.get('submittedCount')
    total_tasks     = data.get('totalTasks')

    print(f"[check-strike] user={username}, unit={current_unit}, "
          f"percent={unit_percent}, submitted={submitted_count}/{total_tasks}")

    # Проверяем входные параметры
    if not all([username, current_unit]) or unit_percent is None \
       or submitted_count is None or total_tasks is None:
        print("[check-strike] Ошибка: Missing parameters")
        return jsonify({"error": "Missing parameters"}), 400

    strikes_data = load_strikes()
    user_data = strikes_data.get(username, {
        "strikes": 0,
        "lastStrikeByUnit": {}
    })
    last_by_unit = user_data["lastStrikeByUnit"]

    # 1) Сброс, если сделал все задачи и percent<80
    if total_tasks > 0 and submitted_count == total_tasks and unit_percent < 80.0:
        print(f"[check-strike] Сброс: пользователь сделал все задачи "
              f"и percent={unit_percent}% < 80%")
        user_data["strikes"] = 0
        last_by_unit.clear()
        strikes_data[username] = user_data
        save_strikes(strikes_data)
        print(f"[check-strike] После сброса: {user_data}")
        return jsonify(user_data)
    elif total_tasks == 0:
        print("[check-strike] Пропущен сброс: в юните нет заданий")

    # 2) Сброс, если перешёл на новый юнит, пропустив предыдущий без штриха
    try:
        idx = Units.index(current_unit)
    except ValueError:
        idx = -1

    if idx > 0:
        prev_unit = Units[idx - 1]
        if prev_unit not in last_by_unit:
            print(f"[check-strike] Сброс: пропущен unit {prev_unit} без штриха")
            user_data["strikes"] = 0
            last_by_unit.clear()
        else:
            print(f"[check-strike] Предыдущий unit {prev_unit} успешно пройден")

    # 3) Начисляем штрих по current_unit, если percent>=80 и ещё нет сегодня
    if unit_percent >= 80.0:
        today_str = datetime.utcnow().strftime('%Y-%m-%d')
        if last_by_unit.get(current_unit) != today_str:
            user_data["strikes"] = user_data.get("strikes", 0) + 1
            last_by_unit[current_unit] = today_str
            print(f"[check-strike] Начислен штрих: strikes={user_data['strikes']}, unit={current_unit}")
        else:
            print(f"[check-strike] Сегодня штрих за {current_unit} уже был")
    else:
        print(f"[check-strike] percent={unit_percent}% < 80, штрихи не изменены")

    strikes_data[username] = user_data
    save_strikes(strikes_data)
    print(f"[check-strike] Конечное состояние: {user_data}")
    return jsonify(user_data)






# Можно добавить endpoint, чтобы получить количество strike по пользователю
@app.route('/api/get-strikes/<username>')
def get_strikes(username):
    strikes_data = load_strikes()
    user_data = strikes_data.get(username, {
        "strikes": 0,
        "lastStrikeUnit": None,
        "lastUpdated": None
    })
    return jsonify(user_data)
    
from flask import jsonify
import operator

@app.route('/api/leaderboard-strikes')
def leaderboard_strikes():
    strikes_data = load_strikes()  # из вашего strikes.json
    # Формируем список [(username, data), ...]
    sorted_items = sorted(
        strikes_data.items(),
        key=lambda item: item[1].get('strikes', 0),
        reverse=True
    )

    top_3 = sorted_items[:3]
    others = sorted_items[3:]

    # Преобразуем в JSON-ответ
    return jsonify({
        "top_3": [
            {"name": user, "strikes": info.get("strikes", 0)}
            for user, info in top_3
        ],
        "others": [
            {"name": user, "strikes": info.get("strikes", 0)}
            for user, info in others
        ]
    })


@app.route('/api/get-results/average', methods=['GET'])
def get_results_average():
    level = request.args.get('level')
    unit = request.args.get('unit')
    username = request.args.get('username')

    if not level or not unit:
        return jsonify({"error": "Missing level or unit"}), 400

    # 1) Собираем все файлы задач (без exam)
    unit_dir = os.path.join(BASE_TASKS_DIR, level, unit)
    if not os.path.isdir(unit_dir):
        return jsonify({"error": "Unit directory not found"}), 404

    all_files = [
        f for f in os.listdir(unit_dir)
        if f.endswith('.json') and 'exam' not in f.lower()
    ]
    total_tasks = len(all_files)

    # 2) Загружаем результаты пользователей
    submissions = load_results(level, unit)
    result = {}

    for user, tasks in submissions.items():
        percents = []

        # Check each task in all_files
        for task_file in all_files:
            task_key = os.path.splitext(task_file)[0]  # Remove .json extension
            percent = 0.0  # Default to 0% for unsubmitted tasks

            if isinstance(tasks, dict):
                # Handle case where tasks is a dictionary
                if task_key in tasks:
                    value = tasks[task_key]
                    if isinstance(value, dict) and 'percent' in value:
                        try:
                            percent = float(value['percent'])
                        except (ValueError, TypeError):
                            percent = 0.0
                    elif isinstance(value, (int, float, str)):
                        try:
                            percent = float(value)
                        except (ValueError, TypeError):
                            percent = 0.0
            elif isinstance(tasks, list):
                # Handle case where tasks is a list
                for item in tasks:
                    if isinstance(item, dict) and 'percent' in item and item.get('task') == task_key:
                        try:
                            percent = float(item['percent'])
                        except (ValueError, TypeError):
                            percent = 0.0
                        break

            percents.append(percent)

        submitted_count = sum(1 for p in percents if p > 0)  # Count non-zero submissions
        total_percent = sum(percents)
        average_percent = (total_percent / total_tasks) if total_tasks > 0 else 0.0

        result[user] = {
            "average_percent": round(average_percent, 2),  # Round for cleaner output
            "submitted_count": submitted_count,
            "total_tasks": total_tasks
        }

    # 3) Если юзер без записей — возвращаем 0/total_tasks
    if username and username not in result:
        result[username] = {
            "average_percent": 0.0,
            "submitted_count": 0,
            "total_tasks": total_tasks
        }

    return jsonify(result), 200
    

@app.route("/api/stories")
def get_stories():
    json_path = os.path.join("data", "stories.json")

    # Создать папку data/, если не существует
    os.makedirs(os.path.dirname(json_path), exist_ok=True)

    # Если файла нет — создать шаблон
    if not os.path.exists(json_path):
        default_data = [
            {
                "title": "Welcome Story",
                "thumbnail": "stories/default.png",
                "videoUrl": "stories/default.mp4"
            }
        ]
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(default_data, f, indent=2)

    # Загрузка stories
    with open(json_path, "r", encoding="utf-8") as f:
        raw_stories = json.load(f)

    stories = []
    for story in raw_stories:
        video = story.get("videoUrl")
        image = story.get("imageUrl")
        thumbnail = story.get("thumbnail", "")

        stories.append({
            "title": story.get("title", "Untitled"),
            "thumbnail": url_for('static', filename=thumbnail),
            "mediaType": "video" if video else "image",
            "mediaUrl": url_for('static', filename=video) if video else (
                url_for('static', filename=image) if image else None
            )
        })

    return jsonify(stories)
    
import google.generativeai as genai
import re

# Embedded Gemini API key (replace with actual key before deployment)
GEMINI_API_KEY = 'AIzaSyDqubnDo6Tcmb1mrlMtyOBfXOId_7dSpdA'

# Configure Gemini client
genai.configure(api_key=GEMINI_API_KEY)
client = genai.GenerativeModel('gemini-2.5-flash')

@app.route('/api/submit-writing-task', methods=['POST'])
def submit_writing_task():
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        level = data.get('level')
        unit = data.get('unit')
        username = data.get('username')
        title = data.get('title')
        answers = data.get('answers', {})
        questions = data.get('questions', [{}])

        if not all([level, unit, username, title]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        if not isinstance(answers, dict):
            return jsonify({'success': False, 'error': 'Invalid answers format'}), 400
        if not answers:
            return jsonify({'success': False, 'error': 'Essay text is required'}), 400

        essay_id, writing_answer = next(iter(answers.items()))
        if not writing_answer or len(writing_answer.strip().split()) < 5:
            return jsonify({'success': False, 'error': 'Essay text is required'}), 400

        word_count = len(writing_answer.strip().split())
        if word_count < 30 or word_count > 200:
            return jsonify({'success': False, 'error': f'Essay must be between 30 and 200 words (current: {word_count})'}), 400

        all_results = load_results(level, unit)
        user_results = all_results.setdefault(username, {})

        if user_results.get(title, {}).get('submitted'):
            return jsonify({'success': False, 'error': f"'{title}' already submitted"}), 403

        topic = questions[0].get('text', 'Write an essay on a given topic. Aim for 30+ words.')
        print(f'[Writing] Topic used for evaluation: {topic}')

        # Gemini Prompt with scoring and suggestion logic
        prompt = (
            f"The following essay is written by an English learner at the {level} level. "
            f"Topic: \"{topic}\"\n\n"
            f"Essay:\n{writing_answer}\n\n"
            f"First, determine whether the essay was likely written by an AI or a human. "
            f"If the essay seems AI-generated, respond with this JSON:\n"
            f"{{\n"
            f"  \"ai_detected\": true\n"
            f"}}\n"
            f"Otherwise, respond with a detailed evaluation as JSON in this format:\n"
            f"{{\n"
            f"  \"ai_detected\": false,\n"
            f"  \"feedback\": {{\n"
            f"    \"task_structure\": \"string\",\n"
            f"    \"organization\": \"string\",\n"
            f"    \"grammar\": \"string\",\n"
            f"    \"vocabulary\": \"string\"\n"
            f"  }},\n"
            f"  \"scores\": {{\n"
            f"    \"task_structure\": number,\n"
            f"    \"organization\": number,\n"
            f"    \"grammar\": number,\n"
            f"    \"vocabulary\": number\n"
            f"  }},\n"
            f"  \"suggestion\": {{\n"
            f"    \"task_structure\": \"short suggestion in Uzbek\",\n"
            f"    \"organization\": \"short suggestion in Uzbek\",\n"
            f"    \"grammar\": \"short suggestion in Uzbek\",\n"
            f"    \"vocabulary\": \"short suggestion in Uzbek\"\n"
            f"  }}\n"
            f"}}\n"
            f"Each score must be from 0 to 25. "
            f"If any score is below 25, explain the reason in the feedback, and provide a practical short suggestion "
            f"in Uzbek for that category and feedback also must be in Uzbek."
        )

        try:
            response = client.generate_content(
                contents=prompt,
                generation_config={'response_mime_type': 'application/json'}
            )
            response_text = response.text
            print(f'[Writing] Raw Gemini response: {response_text}')

            response_text = re.sub(r'(?<!\\)\\(?![\\"/bfnrt])', r'\\\\', response_text)
            response_text = re.sub(r'("[^"]*"\s*:\s*"[^"]*"\s*)\s*\w+\s*}', r'\1}', response_text)

            try:
                gemini_result = json.loads(response_text)
            except json.JSONDecodeError as e:
                print(f'[Writing] ? JSON parsing error: {str(e)}. Response text: {response_text}')
                return jsonify({'success': False, 'error': f'Invalid AI response: JSON parsing failed ({str(e)})'}), 500

            ai_detected = gemini_result.get("ai_detected", False)
            if ai_detected:
                feedback = {
                    'task_structure': 'AI Detected',
                    'organization': 'AI Detected',
                    'grammar': 'AI Detected',
                    'vocabulary': 'AI Detected'
                }
                scores = {
                    'task_structure': 0,
                    'organization': 0,
                    'grammar': 0,
                    'vocabulary': 0
                }
                total_score = 0
            else:
                feedback = gemini_result.get('feedback', {})
                scores = gemini_result.get('scores', {})
                suggestions = gemini_result.get('suggestion', {})

                # Score clamping for safe total
                ts_score = min(max(scores.get('task_structure', 0), 0), 25)
                org_score = min(max(scores.get('organization', 0), 0), 25)
                grammar_score = min(max(scores.get('grammar', 0), 0), 25)
                vocab_score = min(max(scores.get('vocabulary', 0), 0), 25)
                total_score = ts_score + org_score + grammar_score + vocab_score

                # Attach suggestions if present
                if suggestions:
                    feedback['suggestion'] = suggestions

        except Exception as e:
            print(f'[Writing] ? Error calling Gemini API: {str(e)}')
            return jsonify({'success': False, 'error': 'Failed to get feedback from Gemini'}), 500

        record = {
            'submitted': True,
            'time': datetime.now().isoformat(sep=' ', timespec='seconds'),
            'correct': 1 if total_score >= 60 else 0,
            'incorrect': 0 if total_score >= 60 else 1,
            'skipped': 0,
            'total': 1,
            'percent': total_score,
            'feedback': feedback,
            'scores': scores,
            'details': [{
                'question_id': essay_id,
                'text': topic,
                'user_answer': writing_answer,
                'correct_answer': '',
                'is_correct': total_score >= 60,
                'feedback': feedback,
                'score': total_score,
                'scores_breakdown': scores
            }]
        }

        if ai_detected:
            record['ai_detected'] = True

        user_results[title] = record
        save_results(level, unit, all_results)

        reward_given = False
        if total_score >= 80:
            reward_given = True
            try:
                add_tx_url = url_for('add_transaction', _external=True)
                resp = requests.post(
                    add_tx_url,
                    json={
                        'username': username,
                        'amount': 100,
                        'description': f"Reward for completing '{title}' with {int(total_score)}%"
                    },
                    timeout=5
                )
                resp.raise_for_status()
            except Exception as e:
                print(f'[Writing] ? Error awarding points: {str(e)}')
                reward_given = False

        return jsonify({
            'success': True,
            'feedback': feedback,
            'scores': scores,
            'score': total_score,
            'reward_given': reward_given
        }), 200

    except Exception as e:
        print(f'[Writing] ? Error submitting writing task: {str(e)}')
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

IDEAS_FOLDER = 'data/ideas/files'       # Папка для загрузки файлов
IDEAS_DATA = 'data/ideas'               # Папка для хранения JSON

os.makedirs(IDEAS_FOLDER, exist_ok=True)
os.makedirs(IDEAS_DATA, exist_ok=True)

@app.route('/submit_idea', methods=['POST'])
def submit_idea():
    username = request.form.get('username')  # Получаем имя из запроса
    if not username:
        return jsonify({"error": "Username required"}), 400

    text = request.form.get('text', '').strip()
    file = request.files.get('media')
    filename = None

    if file:
        filename = datetime.now().strftime('%Y%m%d%H%M%S_') + secure_filename(file.filename)
        file_path = os.path.join(IDEAS_FOLDER, filename)
        file.save(file_path)

    idea = {
        "text": text,
        "media": f"/get_file/{filename}" if filename else None,
        "timestamp": datetime.now().isoformat(),
        "status": "In review"
    }

    user_file = os.path.join(IDEAS_DATA, f"{username}.json")
    ideas = []
    if os.path.exists(user_file):
        with open(user_file, 'r', encoding='utf-8') as f:
            ideas = json.load(f)

    ideas.append(idea)

    with open(user_file, 'w', encoding='utf-8') as f:
        json.dump(ideas, f, ensure_ascii=False, indent=2)

    return jsonify({"success": True})

@app.route('/get_ideas/<username>')
def get_ideas(username):
    user_file = os.path.join(IDEAS_DATA, f"{username}.json")
    if os.path.exists(user_file):
        with open(user_file, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify([])

@app.route('/get_file/<filename>')
def get_file(filename):
    return send_from_directory(IDEAS_FOLDER, filename)
    
DATA_PACK_TASKS = 'data/tasks'  # заменили BASE_DIR

def get_task_file_path(username):
    return os.path.join(DATA_PACK_TASKS, username, 'task-list.json')

def load_tasks_pack(username):
    path = get_task_file_path(username)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_tasks(username, tasks):
    user_dir = os.path.join(DATA_PACK_TASKS, username)
    os.makedirs(user_dir, exist_ok=True)
    with open(get_task_file_path(username), 'w', encoding='utf-8') as f:
        json.dump(tasks, f, indent=2, ensure_ascii=False)

@app.route('/api/tasks-list/<username>', methods=['GET'])
def get_tasks(username):
    tasks = load_tasks_pack(username)
    return jsonify(tasks), 200

@app.route('/api/task-status/<username>', methods=['GET'])
def get_task_status(username):
    tasks = load_tasks_pack(username)
    total = len(tasks)
    completed = sum(1 for t in tasks if t.get('completed') == True)
    pending = total - completed
    return jsonify({
        "total": total,
        "completed": completed,
        "pending": pending
    }), 200

@app.route('/api/create-task/<username>', methods=['POST'])
def create_task(username):
    data = request.json
    required_fields = ['title', 'deadline', 'reward']

    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        reward_points = int(data['reward'])
    except ValueError:
        return jsonify({"error": "Reward must be a number (e.g., 700)"}), 400

    tasks = load_tasks_pack(username)

    new_task = {
        "id": len(tasks) + 1,
        "title": data['title'],
        "deadline": data['deadline'],
        "reward": reward_points,
        "created_at": datetime.now().isoformat(),
        "completed": False,
        "claimed": False
    }

    tasks.append(new_task)
    save_tasks(username, tasks)
    return jsonify({"message": "Task created", "task": new_task}), 201

@app.route('/api/claim-task/<username>/<int:task_id>', methods=['POST'])
def claim_task(username, task_id):
    tasks = load_tasks_pack(username)

    for task in tasks:
        if task['id'] == task_id:
            if not task.get('completed'):
                return jsonify({"error": "Task not completed"}), 400
            if task.get('claimed'):
                return jsonify({"error": "Reward already claimed"}), 400

            task['claimed'] = True
            save_tasks(username, tasks)

            # Вызов твоей функции
            result = add_transaction_internal(
                username,
                task['reward'],
                f"Claimed reward for task: {task['title']}"
            )
            return jsonify(result), 200

    return jsonify({"error": "Task not found"}), 404
    
@app.route('/api/get-personal-suggestions', methods=['GET'])
def get_personal_suggestions():
    username = request.args.get('username')
    level    = request.args.get('level')
    unit     = request.args.get('unit')

    if not all([username, level, unit]):
        return jsonify({"error": "Missing username, level or unit"}), 400

    try:
        current_w, current_d = map(int, unit.split('.'))
    except ValueError:
        return jsonify({"error": "Invalid unit format"}), 400

    def is_before_or_equal(u):
        try:
            w, d = map(int, u.split('.'))
            return (w < current_w) or (w == current_w and d <= current_d)
        except:
            return False

    writing_units = [u for u in Units if is_before_or_equal(u)]
    writing_history = []

    for u in writing_units:
        results = load_results(level, u)
        user_data = results.get(username, {})
        writing_task = user_data.get("Writing AI", {})

        if writing_task.get("submitted"):
            writing_history.append({
                "unit": u,
                "scores": writing_task.get("scores", {}),
                "percent": writing_task.get("percent", 0)
            })

    if len(writing_history) < 2:
        return jsonify({"error": "Not enough writing tasks submitted"}), 200

    prev, curr = writing_history[-2], writing_history[-1]

    diff = {
        "grammar_change": curr["scores"].get("grammar", 0) - prev["scores"].get("grammar", 0),
        "vocabulary_change": curr["scores"].get("vocabulary", 0) - prev["scores"].get("vocabulary", 0),
        "organization_change": curr["scores"].get("organization", 0) - prev["scores"].get("organization", 0),
        "task_structure_change": curr["scores"].get("task_structure", 0) - prev["scores"].get("task_structure", 0),
        "previous_unit": prev["unit"],
        "current_unit": curr["unit"]
    }

    comments = []

    if diff["grammar_change"] > 0:
        comments.append("Grammatika yaxshilandi.")
    elif diff["grammar_change"] < 0:
        comments.append("Grammatika yomonlashdi.")

    if diff["vocabulary_change"] > 0:
        comments.append("Lug'at boyligi oshdi.")
    elif diff["vocabulary_change"] < 0:
        comments.append("Lug'at boyligi kamaydi.")

    if diff["organization_change"] > 0:
        comments.append("Tuzilish yaxshilandi.")
    elif diff["organization_change"] < 0:
        comments.append("Tuzilish yomonlashdi.")

    if diff["task_structure_change"] > 0:
        comments.append("Insho strukturasi yaxshilandi.")
    elif diff["task_structure_change"] < 0:
        comments.append("Insho strukturasi yomonlashdi.")

    return jsonify({**diff, "comment": " ".join(comments)}), 200

@app.route('/api/compare-essays-ai-get', methods=['GET'])
def compare_essays_ai_get():
    username = request.args.get('username')
    level = request.args.get('level')
    unit = request.args.get('unit')  # ������� ���� (��������: 3.2)

    if not all([username, level, unit]):
        return jsonify({'error': 'Missing username, level or unit'}), 400

    # ������ ������ �� ��������
    try:
        current_index = Units.index(unit)
        if current_index < 1:
            return jsonify({'error': 'No previous unit to compare with'}), 400
        prev_unit = Units[current_index - 1]
    except Exception as e:
        return jsonify({'error': f'Invalid unit: {e}'}), 400

    # �������� ���������� ��� �������� � ����������� �����
    curr_data = load_results(level, unit).get(username, {}).get('Writing AI')
    prev_data = load_results(level, prev_unit).get(username, {}).get('Writing AI')

    if not curr_data or not prev_data:
        return jsonify({'error': 'Missing essay data in current or previous unit'}), 404

    curr_essay = curr_data['details'][0]
    prev_essay = prev_data['details'][0]

    # ���������� prompt
    prompt = (
        f"You are an AI language teacher evaluating the progress of an English learner at the {level} level.\n\n"
        f"--- Previous Essay ---\n"
        f"Topic: {prev_essay.get('text')}\n"
        f"{prev_essay.get('user_answer')}\n\n"
        f"--- Current Essay ---\n"
        f"Topic: {curr_essay.get('text')}\n"
        f"{curr_essay.get('user_answer')}\n\n"
        f"Compare both essays and return JSON:\n"
        f"{{\n"
        f"  \"grammar\": {{\"change\": number, \"comment\": \"Uzbek\"}},\n"
        f"  \"vocabulary\": {{\"change\": number, \"comment\": \"Uzbek\"}},\n"
        f"  \"organization\": {{\"change\": number, \"comment\": \"Uzbek\"}},\n"
        f"  \"task_structure\": {{\"change\": number, \"comment\": \"Uzbek\"}},\n"
        f"  \"overall_comment\": \"Uzbek summary\"\n"
        f"}}"
    )

    try:
        response = client.generate_content(
            contents=prompt,
            generation_config={'response_mime_type': 'application/json'}
        )
        response_text = response.text.strip()
        result = json.loads(response_text)
        return jsonify({'success': True, 'analysis': result}), 200

    except Exception as e:
        print(f'[Compare AI GET] Error: {e}')
        return jsonify({'error': 'Failed to compare essays with AI'}), 500


        
if __name__ == '__main__':
    # Отключаем use_reloader, чтобы не пытаться читать WERKZEUG_SERVER_FD
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=True
    )

