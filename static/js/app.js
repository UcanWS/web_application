    const socket = io();
    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('nav a');
    const chatItems = document.querySelectorAll('.chat-item');
    const backBtn = document.querySelector('.back');
    const avatar = document.getElementById('avatar');
    const profileAvatar = document.getElementById('profile-avatar');
    const messagesDiv = document.getElementById('messages');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const fileInput = document.getElementById('file-input');
    const sendButton = document.getElementById('send-button');
    const usernameDisplay = document.getElementById('username-display');
    const changeAvatarBtn = document.getElementById('change-avatar');
    const avatarInput = document.getElementById('avatar-input');
    const balanceAmount = document.getElementById('balance-amount');
    const balanceStatus = document.getElementById('balance-status');
    const loginBtn = document.getElementById('login-btn');
    const currentUser = sessionStorage.getItem('username') || 'Guest';
    let currentChatId = null;
	let accountStatus = null;
	
function fetchPoints(username) {
  const pointsValue = document.getElementById("points-value");
  const progressCard = document.getElementById("progress-card");

  if (!pointsValue || !progressCard) return;

  const mainPage = document.getElementById("main");
  if (!mainPage.classList.contains("active")) return;

  // Используем Intl для форматирования в компактном стиле
  const formatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1
  });

  const updatePointsValue = () => {
    const cachedPoints = sessionStorage.getItem('userPoints');
    if (cachedPoints) {
      pointsValue.innerText = formatter.format(parseInt(cachedPoints));
      return true;
    }

    fetch(`/api/get_balance/${username}`)
      .then(response => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(data => {
        const formatted = formatter.format(data.balance);
        pointsValue.innerText = formatted;
        sessionStorage.setItem('userPoints', data.balance);
      })
      .catch(() => {
        pointsValue.innerText = "0";
        sessionStorage.setItem('userPoints', "0");
      });

    return false;
  };

  if (progressCard.style.display !== "none") {
    updatePointsValue();
  } else {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === "style" && progressCard.style.display !== "none") {
          updatePointsValue();
          observer.disconnect();
        }
      });
    });
    observer.observe(progressCard, { attributes: true });
  }
}


const updateCoinsValue = () => {
  const username = sessionStorage.getItem("username");
  if (!username) return;

  fetch(`/api/get_user_coins/${username}`)
    .then(res => res.json())
    .then(data => {
      if (data && typeof data.coins === "number") {
        const coins = Math.floor(data.coins); // удаляет дробную часть
        document.getElementById("coins-value").textContent = coins.toLocaleString();
      } else {
        document.getElementById("coins-value").textContent = "--";
      }
    })
    .catch(() => {
      document.getElementById("coins-value").textContent = "--";
    });
};

    // Show username and avatar
    document.getElementById('username').textContent = currentUser;
    usernameDisplay.textContent = currentUser;
    fetch(`/get_avatar/${currentUser}`)
      .then(res => res.json())
      .then(data => {
        if (data.avatar_url) {
          avatar.src = data.avatar_url;
          profileAvatar.src = data.avatar_url;
          avatar.style.display = 'block';
          profileAvatar.style.display = 'block';
        }
      });

    // Show login button if Guest
if (currentUser === 'Guest') {
  loginBtn.style.display = 'block';


  const reminderInterval = setInterval(() => {
    if (currentUser === 'Guest') {
     showModalStatus("You are not authorized. Please log in to your account to continue.", "failed");
    } else {
      clearInterval(reminderInterval); // Прекратить, если вошёл
    }
  }, 3000); // каждые 60 секунд
}


    // Handle connection errors
    socket.on('connect_error', (err) => {
      const errorDiv = document.createElement('div');
      errorDiv.classList.add('error-message');
      errorDiv.textContent = `Connection failed: ${err.message}. Please try again.`;
      messagesDiv.appendChild(errorDiv);
    });

let currentPageId = null; // глобальная переменная для отслеживания текущей страницы

function showPage(id) {
  let [pageId, subPage] = id.split('/');

  // 🔹 Если открываем ту же страницу без подстраницы — просто выходим
  if (currentPageId === id) {
    console.log(`Страница ${id} уже открыта — пропускаем повторный рендер`);
    return;
  }
  currentPageId = id; // обновляем текущую страницу

  // Страницы, запрещённые для должников
  const blockedPages = ['chat-list', 'progress', 'shop', 'coins-page'];
  if (accountStatus === 'Debtor' && blockedPages.includes(pageId)) {
    showToastNotification(
      "It seems you don't have enough money to get access to this page.",
      'error'
    );
    return;
  }

  // Показываем нужную страницу
  pages.forEach(p => {
    const isTarget = p.id === pageId;
    p.classList.toggle('active', isTarget);
    p.style.display = isTarget ? 'block' : 'none';
  });

  // Активируем ссылку в навигации
  navLinks.forEach(a => {
    a.classList.toggle('active', a.dataset.page === pageId);
  });

  // Обновляем URL
  history.pushState(null, '', `/${pageId}` + (subPage ? `/${subPage}` : ''));
  console.log(`Переключение на страницу: ${pageId}` + (subPage ? `, subsection: ${subPage}` : ''));

  // Хуки на страницу
  switch (pageId) {
    case 'chat-ui':
      scrollToBottom();
      hideNavigation();
      break;

    case 'chat-list':
      showNavigation();
      break;

    case 'main':
      fetchStudentProgress();
      setTimeout(() => {
        fetchPoints(currentUser);
        fetchLeaderboardRank(currentUser);
        loadUserCoins(currentUser);
      }, 1000);
      break;

    case 'progress':
      fetchStudentProgress();
      break;

    case 'leaderboard':
      updateLeaderboardUI();
      break;

    case 'coins-page':
      fetchDebts();
      break;

    case 'shop':
      openShop(currentUser);
      break;

    case 'inventory':
      initializeInventory(currentUser);
      break;

    case 'today':
      updateDays();
      updateTaskCount();
      fetchInitialExamTime();
      renderTasksSection();
      break;

    case 'notifications':
      onNotificationsPageOpen();
      showNotifIndicator(false);
      break;

    case 'private-chatlist':
      currentPrivateUser = null;
      showNavigation();
      loadPrivateChatUsers();
      break;

    case 'chat-ui-private':
      hideNavigation();
      break;

    case 'settings':
      fetchSessions();
      break;

    case 'exams':
      examsPageActive();
      break;

    case 'upload':
      loadIdeas();
      break;

    case 'tasks':
      loadTasks();
      break;

    case 'personal-analyzing':
      loadPersonalSummary(currentUser, currentLevel, currentUnit);
      break;

    case 'squid-game':
      createVideoPlayer('static/horror/trailer-squid-game.mp4', 'video-player-squid');
      startCountdownSquidTimer("2025-08-31T00:00:00", "countdown-timer");  
      break;

    case 'liveLesson':
      openLiveLesson();
      break;
	case 'writing-top-list':
      showWritingTopList();
      break;
	case 'my-certificates':
      loadCertificates(currentLevel);
      break;
  }
}


let currentPrivateUser = null;

function scrollMessagesToBottom() {
  const chatBox = document.querySelector('.messages-private');
  if (chatBox) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

async function loadPrivateChatUsers() {
  const listContainer = document.getElementById('private-chat-list');
  listContainer.innerHTML = '';

  // Скелетоны
  for (let i = 0; i < 4; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'chat-private-item skeleton';
    skeleton.innerHTML = `<i></i><div></div>`;
    listContainer.appendChild(skeleton);
  }

  try {
    const usersResponse = await fetch('/api/users');
    const users = await usersResponse.json();
    const allChatsResponse = await fetch('/chat/all');
    const allChats = await allChatsResponse.json();

    listContainer.innerHTML = '';

    const usernames = Object.keys(users).filter(u => u !== currentUser);
    if (usernames.length === 0) {
      listContainer.innerHTML = '<p>No users found.</p>';
      return;
    }

    usernames.sort((a, b) => {
      const roomA = getRoomId(currentUser, a);
      const roomB = getRoomId(currentUser, b);
      const messagesA = allChats[roomA] || [];
      const messagesB = allChats[roomB] || [];
      const lastA = messagesA[messagesA.length - 1] || null;
      const lastB = messagesB[messagesB.length - 1] || null;
      if (!lastA && !lastB) return 0;
      if (!lastA) return 1;
      if (!lastB) return -1;
      const timeA = new Date(lastA.timestamp).getTime();
      const timeB = new Date(lastB.timestamp).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return (lastA.sender !== currentUser) ? -1 : 1;
    });

    for (const username of usernames) {
      const avatarResponse = await fetch(`/get_avatar/${username}`);
      const { avatar_url } = await avatarResponse.json();

      const roomId = getRoomId(currentUser, username);
      const messages = allChats[roomId] || [];
      const last = messages[messages.length - 1] || null;

      let preview = '<p>Start private chat</p>';
      if (last) {
        if (last.media_url) preview = '<p>[media]</p>';
        else if (last.message) {
          const msg = last.message.length > 40 ? last.message.slice(0, 40) + '...' : last.message;
          preview = `<p>${msg}</p>`;
        }
      }

      const unreadCount = messages.filter(
        m => m.receiver === currentUser && !m.read
      ).length;

      const item = document.createElement('div');
      item.className = 'chat-private-item';
      item.dataset.chat = username;

      const avatarHtml = avatar_url
        ? `<div class="avatar"><img src="${avatar_url}" alt="${username}'s avatar"></div>`
        : `<div class="avatar fallback">!</div>`;

      item.innerHTML = `
        ${avatarHtml}
        <div>
          <strong>${username}</strong>
          ${preview}
        </div>
        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
      `;

      item.onclick = () => openPrivateChat(username);
      listContainer.appendChild(item);
    }
  } catch (err) {
    listContainer.innerHTML = `<p>Error loading users: ${err}</p>`;
  }
}

// Генерация room_id в JS
function getRoomId(user1, user2) {
  return [user1, user2].sort().join('_');
}


// Открыть чат
function openPrivateChat(username) {
  currentPrivateUser = username;

  showPage('chat-ui-private');

  // Присоединение к сокет-комнате
  socket.emit('join_private', {
    sender: currentUser,
    receiver: username
  });

  // Загрузка чата
  loadPrivateMessages();
  scrollMessagesToBottom();

  // Проверка онлайн-статуса
  fetch('/api/sessions/')
    .then(res => res.json())
    .then(data => {
      const isOnline = data.sessions.some(s => s.username === username);
      const title = `${username} ${isOnline ? '<span class="online-status">● online</span>' : '<span class="offline-status">● offline</span>'}`;
      document.getElementById('private-chat-username').innerHTML = title;
    })
    .catch(err => {
      console.error('Error fetching session data:', err);
      document.getElementById('private-chat-username').innerText = username;
    });
	
	const chatItem = document.querySelector(`.chat-private-item[data-chat="${username}"]`);
if (chatItem) {
  chatItem.classList.remove('unread');
}
}


// Загрузка истории
function loadPrivateMessages() {
  const chatBox = document.getElementById('private-messages');
  chatBox.innerHTML = '<p>Loading...</p>';

  fetch(`/chat/${currentUser}/${currentPrivateUser}`)
    .then(res => res.json())
    .then(messages => {
      chatBox.innerHTML = '';
      messages.forEach(addPrivateMessage);
      chatBox.scrollTop = chatBox.scrollHeight;
      scrollMessagesToBottom();

      // ⬅️ Пометить сообщения как прочитанные
      markMessagesAsRead();
	  scrollMessagesToBottom();
    })
    .catch(err => {
      chatBox.innerHTML = `<p>Error loading messages: ${err}</p>`;
    });
}

function markMessagesAsRead() {
  fetch(`/chat/read/${currentUser}/${currentPrivateUser}`, {
    method: 'POST'
  }).catch(console.error);
}



// Отправка текста
function sendPrivateTextMessage() {
  const input = document.getElementById('private-message-input');
  const message = input.value.trim();
  if (!message) return;

  const msg = {
    sender: currentUser,
    receiver: currentPrivateUser,
    message: message,
    timestamp: new Date().toISOString()
  };

  socket.emit('send_private_message', msg);
  input.value = '';
}

// Обработка Enter
document.getElementById('private-message-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendPrivateTextMessage();
  }
});

// Кнопка отправки
document.getElementById('private-send-button').onclick = sendPrivateTextMessage;

// Отправка медиа
document.getElementById('private-file-input').onchange = function () {
  const file = this.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('sender', currentUser);
  formData.append('receiver', currentPrivateUser);

  fetch('/chat/send_media', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      if (data.media_url) {
        const msg = {
          sender: currentUser,
          receiver: currentPrivateUser,
          message: '',
          media_url: data.media_url,
          timestamp: new Date().toISOString()
        };
        socket.emit('send_private_message', msg);
      }
    })
    .catch(console.error);

  this.value = ''; // сброс input
};

socket.emit('join_all_private_rooms', { username: currentUser });

socket.on('receive_private_message', msg => {
  scrollMessagesToBottom();
  const isCurrentChat =
    (msg.sender === currentPrivateUser && msg.receiver === currentUser) ||
    (msg.sender === currentUser && msg.receiver === currentPrivateUser);

  if (isCurrentChat) {
    addPrivateMessage(msg);

    // ⬅️ Если ты сейчас в этом чате — пометить как прочитанное
    if (msg.receiver === currentUser) {
      markMessagesAsRead();
    }
  } else {
    showChatNotification({ sender: msg.sender, message: msg.message });
    loadPrivateChatUsers();

    const chatItem = document.querySelector(`.chat-private-item[data-chat="${msg.sender}"]`);
    if (chatItem) {
      chatItem.classList.add('unread');
    }
  }
});


function showChatNotification({ sender, message }) {
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast info`;
  toast.style.setProperty('--hide-delay', `7s`);

  const icon = document.createElement('div');
  icon.className = 'toast-icon';
  icon.innerHTML = `<i class="fas fa-comments"></i>`;

  const msg = document.createElement('div');
  msg.className = 'toast-message';
  msg.innerHTML = `<b>${sender}</b>: ${message || '[media]'}`;

  const openBtn = document.createElement('div');
  openBtn.className = 'toast-action';
  openBtn.innerHTML = `Open Chat`;
  openBtn.onclick = () => {
    openPrivateChat(sender);
    toast.remove();
  };

  const closeBtn = document.createElement('div');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => toast.remove();

  toast.append(icon, msg, openBtn, closeBtn);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('active'));
  //setTimeout(() => toast.remove(), 7000);
}

// Добавить сообщение в DOM
function addPrivateMessage(msg) {
  const chatBox = document.getElementById('private-messages');
  const div = document.createElement('div');

  const isSentByMe = msg.sender === currentUser;

  div.className = 'message-private ' + (isSentByMe ? 'sent' : 'received');

  let readIcon = '';
  if (isSentByMe) {
    const isRead = msg.read === true;
    readIcon = `<span class="read-status ${isRead ? 'read' : 'unread'}">
      <i class="fas fa-check"></i>
    </span>`;
  }

  div.innerHTML = `
    <strong>${msg.sender}</strong> ${msg.message || ''}
    ${msg.media_url ? renderMedia(msg.media_url) : ''}
    <br><small>${new Date(msg.timestamp).toLocaleString()} ${readIcon}</small>
  `;

  chatBox.appendChild(div);
  scrollMessagesToBottom();
}



// Media cache
const mediaCache = new Map();

function renderMedia(url) {
  const ext = url.split('.').pop().toLowerCase();
  const wrapperId = `media-${Math.random().toString(36).substring(2, 9)}`;

  let typeLabel = '';
  let icon = '';

  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
    typeLabel = 'Photo';
    icon = 'fa-image';
  } else if (['mp4', 'webm', 'mov'].includes(ext)) {
    typeLabel = 'Video';
    icon = 'fa-video';
  } else if (['mp3'].includes(ext)) {
    typeLabel = 'Audio';
    icon = 'fa-music';
  } else {
    typeLabel = 'File';
    icon = 'fa-file-alt';
  }

  return `
    <div id="${wrapperId}" class="media-wrapper-private">
      <button onclick="downloadAndShowMedia('${url}', '${ext}', '${wrapperId}')" class="media-download-btn">
        <i class="fas ${icon}"></i> Download ${typeLabel}
      </button>
      <div class="media-content" style="margin-top: 10px;"></div>
    </div>
  `;
}

function downloadAndShowMedia(url, ext, wrapperId) {
  const wrapper = document.getElementById(wrapperId);
  const mediaBox = wrapper.querySelector('.media-content');
  const btn = wrapper.querySelector('.media-download-btn');

  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Downloading...`;

  // Check cache
  if (mediaCache.has(url)) {
    renderFromBlobURL(mediaCache.get(url), ext, mediaBox, btn, wrapperId);
    return;
  }

  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      mediaCache.set(url, blobUrl);
      renderFromBlobURL(blobUrl, ext, mediaBox, btn, wrapperId);
    })
    .catch(err => {
      btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Failed`;
      console.error('Download failed:', err);
    });
}

function renderFromBlobURL(blobUrl, ext, container, btn, wrapperId) {
  let html = '';

  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
    html = `<img src="${blobUrl}" class="media-img-private">`;
    btn.remove();
  } else if (['mp4', 'webm', 'mov'].includes(ext)) {
    html = `<video controls preload="metadata" class="media-video-private">
              <source src="${blobUrl}" type="video/${ext}">
            </video>`;
    btn.remove();
  } else if (['mp3'].includes(ext)) {
    html = `
      <div class="telegram-audio-player-private">
        <button class="play-pause-btn-private">
          <i class="fas fa-play"></i>
        </button>
        <div class="progress-container-private">
          <div class="progress-bar-private"></div>
          <div class="progress-scrubber-private"></div>
        </div>
        <div class="time-display-private">
          <span class="current-time">0:00</span> / <span class="duration">0:00</span>
        </div>
        <button class="speed-btn-private">1x</button>
      </div>
      <audio id="audio-${wrapperId}" src="${blobUrl}"></audio>
    `;
  } else {
    html = `<a href="${blobUrl}" download class="media-file-link-private">
              <i class="fas fa-file-download"></i> Download file
            </a>`;
    btn.remove();
  }

  container.innerHTML = html;

  if (ext === 'mp3') {
    const audio = document.getElementById(`audio-${wrapperId}`);
    const playPauseBtn = container.querySelector('.play-pause-btn-private');
    const progressBar = container.querySelector('.progress-bar-private');
    const scrubber = container.querySelector('.progress-scrubber-private');
    const currentTimeDisplay = container.querySelector('.current-time');
    const durationDisplay = container.querySelector('.duration');
    const speedBtn = container.querySelector('.speed-btn-private');

    let isDragging = false;
    const speeds = [1, 1.5, 2];
    let currentSpeedIndex = 0;

    // Format time in MM:SS
    function formatTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      seconds = Math.floor(seconds % 60);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    // Update progress bar and time display
    audio.addEventListener('loadedmetadata', () => {
      durationDisplay.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      if (!isDragging) {
        const progress = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${progress}%`;
        scrubber.style.left = `${progress}%`;
        currentTimeDisplay.textContent = formatTime(audio.currentTime);
      }
    });

    // Play/Pause toggle
    playPauseBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      } else {
        audio.pause();
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      }
    });

    // Playback speed toggle
    speedBtn.addEventListener('click', () => {
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      audio.playbackRate = speeds[currentSpeedIndex];
      speedBtn.textContent = `${speeds[currentSpeedIndex]}x`;
    });

    // Scrubber drag functionality
    progressBar.parentElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      updateScrubber(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) updateScrubber(e);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    function updateScrubber(e) {
      const rect = progressBar.parentElement.getBoundingClientRect();
      let pos = (e.clientX - rect.left) / rect.width;
      pos = Math.max(0, Math.min(1, pos));
      const time = pos * audio.duration;
      audio.currentTime = time;
      progressBar.style.width = `${pos * 100}%`;
      scrubber.style.left = `${pos * 100}%`;
      currentTimeDisplay.textContent = formatTime(time);
    }

    btn.remove();
  }
}

socket.on('messages_read', ({ reader, sender }) => {
  if (sender !== currentUser) return;

  const icons = document.querySelectorAll('.message-private.sent .read-status');
  icons.forEach(el => {
    el.classList.remove('unread');
    el.classList.add('read');
  });
});





// === JS: открыть страницу Notifications и загрузить данные ===
const notifBtn   = document.getElementById('notifications-btn');
const notifList  = document.getElementById('notifications-list');
const toggleBtns = document.querySelectorAll('#notifications .notif-toggle button');
const username   = document.getElementById('username').textContent;

// Показываем страницу при клике на колокольчик
notifBtn.addEventListener('click', e => {
  e.preventDefault();
  showPage('notifications');
});

// При открытии страницы notifications грузим General
function onNotificationsPageOpen() {
  // Активируем кнопку General
  toggleBtns.forEach(b => b.classList.toggle('active', b.dataset.type === 'general'));
  loadNotifications('general');
}

// Обработчики переключателя внутри страницы
toggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    toggleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadNotifications(btn.dataset.type);
  });
});

// Функция загрузки уведомлений с заголовком
async function loadNotifications(type) {
  const url = type === 'important'
    ? `/api/notifications/important`
    : `/api/notifications/general/${username}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const list = data.notifications;

    notifList.innerHTML = (Array.isArray(list) && list.length)
      ? list.reverse().map(n => `
        <li class="notification-item ${type}">
          <div class="notification-icon">
            <i class="fas ${ type === 'important' ? 'fa-exclamation-circle' : 'fa-info-circle' }"></i>
          </div>
          <div class="notification-text">
            <div class="notification-title">${n.title || (type === 'important' ? 'Important Notice' : 'Notification')}</div>
            <div class="notification-message">${n.message}</div>
          </div>
        </li>
      `).join('')
      : `<li class="no-notifs">No ${type} notifications.</li>`;

  } catch (err) {
    console.error(err);
    showToastNotification('Ошибка при загрузке уведомлений', 'error');
  }
}


function showNotifIndicator(show) {
  const dot = document.getElementById('notif-indicator');
  if (dot) dot.style.display = show ? 'block' : 'none';
}

socket.on('new_notification', function(data) {
	showNotifIndicator(true);
    showToastNotification('<b>' + data.message + '</b>', 'info', 5000);
});

async function logout() {
  try {
    const response = await fetch('/logout', { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      sessionStorage.clear(); // Очистка sessionStorage
      window.location.href = '/login'; // Редирект на /login
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('Failed to logout.');
  }
}

async function loadUserPoints(username) {
  try {
    const res = await fetch(`/api/get_balance/${username}`);
    const data = await res.json();
    if (res.ok) {
      document.getElementById("points-balance").textContent = data.balance ?? "--";
    } else {
      document.getElementById("points-balance").textContent = "--";
    }
  } catch (e) {
    document.getElementById("points-balance").textContent = "--";
    console.error("Failed to load points:", e);
  }
}

async function loadUserCoins(username) {
  try {
    const res = await fetch(`/api/get_user_coins/${username}`);
    const data = await res.json();

    if (res.ok && typeof data.coins === "number") {
      const coins = Math.floor(data.coins); // Убираем дробную часть
      const formattedCoins = coins.toLocaleString(); // Форматируем для читаемости

      document.getElementById("coins-value").textContent = formattedCoins;
      document.getElementById("coins-value-in-page").textContent = formattedCoins;
    } else {
      document.getElementById("coins-value").textContent = "--";
      document.getElementById("coins-value-in-page").textContent = "--";
    }
  } catch (e) {
    document.getElementById("coins-value").textContent = "--";
    document.getElementById("coins-value-in-page").textContent = "--";
    console.error("Failed to load coins:", e);
  }
}


async function loadPointsHistory(username) {
  const container = document.getElementById("points-history");
  container.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const res = await fetch(`/api/points_history/${username}`);
    const data = await res.json();

    if (res.ok && Array.isArray(data.history)) {
      if (data.history.length === 0) {
        container.innerHTML = '<div class="loading">No transactions yet.</div>';
        return;
      }

      data.history.sort((a, b) => new Date(b.time) - new Date(a.time));
      container.innerHTML = "";

      const currencyFormatter = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      });

      const dateOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };

      data.history.forEach(entry => {
        const div = document.createElement("div");
        div.className = `transaction-entry ${entry.amount > 0 ? "positive" : "negative"}`;

        const date = new Date(entry.time);
        const timeString = date.toLocaleString(undefined, dateOptions);

        div.innerHTML = `
          <div class="entry-info">
            <div class="entry-description">${entry.description}</div>
            <div class="entry-time">${timeString}</div>
          </div>
          <div class="entry-meta">
            <div class="entry-amount">${entry.amount > 0 ? "+" : ""}${currencyFormatter.format(entry.amount)}</div>
            <div class="entry-balance-before">Before: ${currencyFormatter.format(entry.balance_before)}</div>
          </div>
        `;

        container.appendChild(div);
      });
    } else {
      container.innerHTML = '<div class="loading">Failed to load point history.</div>';
    }
  } catch (e) {
    console.error("Error fetching history:", e);
    container.innerHTML = '<div class="loading">Network error.</div>';
  }
}







document.getElementById("exchange-btn").addEventListener("click", async () => {
  const username = sessionStorage.getItem("username");
  const pointsToExchange = parseInt(document.getElementById("exchange-input").value.trim());
  const statusEl = document.getElementById("exchange-status");

  if (!username || isNaN(pointsToExchange) || pointsToExchange < 10) {
    statusEl.textContent = "Please enter at least 10 points.";
    statusEl.className = "exchange-error";
    showModalStatus("Please enter at least 10 points.", "failed");
    return;
  }

  try {
    const res = await fetch("/api/exchange_points_to_coins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, points: pointsToExchange })
    });

    const result = await res.json();

if (res.ok) {
  const coinsReceived = result.coins_added;

  loadPointsHistory(username);
  loadUserCoins(username);
  loadUserPoints(username);
  updateCoinsValue();

  sessionStorage.removeItem("userPoints");

  statusEl.textContent = `✅ Exchanged successfully! You received ${coinsReceived} coin${coinsReceived !== 1 ? 's' : ''}`;
  statusEl.className = "exchange-success flash";
  showModalStatus(`You received ${coinsReceived} coin${coinsReceived !== 1 ? 's' : ''}`, "success");

  document.getElementById("exchange-input").value = "";
}
 else {
      statusEl.textContent = `❌ Error: ${result.error}`;
      statusEl.className = "exchange-error";
      showModalStatus(`Error: ${result.error}`, "failed");
    }
  } catch (err) {
    statusEl.textContent = "❌ Network error. Try again.";
    statusEl.className = "exchange-error";
    showModalStatus("Network error. Try again.", "failed");
  }

  setTimeout(() => statusEl.classList.remove("flash"), 800);
});


document.querySelector(".progress-item.coins").addEventListener("click", () => {
  showPage("coins-page");
  const username = sessionStorage.getItem("username");
  if (username) {
	loadPointsHistory(username);
    loadUserCoins(username); // обновляет в самой странице
    loadUserPoints(username); // обновляет points
    updateCoinsValue();       // 🔄 обновляет иконку снизу
    sessionStorage.removeItem("userPoints"); // удаляем кэш, чтобы пересчитался
  }
});


document.querySelector(".progress-item.points").addEventListener("click", () => {
  showPage("points-page");
  const username = sessionStorage.getItem("username");
  if (username) {
	loadPointsHistory(username);
    loadUserCoins(username); // обновляет в самой странице
    loadUserPoints(username); // обновляет points
    updateCoinsValue();       // 🔄 обновляет иконку снизу
    sessionStorage.removeItem("userPoints"); // удаляем кэш, чтобы пересчитался
  }
});


document.querySelector(".progress-item.strike").addEventListener("click", () => {
  showPage("strikes-page");

  const username = sessionStorage.getItem("username");
  if (!username) return;

  fetch(`/api/get-strikes/${encodeURIComponent(username)}`)
    .then(res => res.json())
    .then(data => {
      const lastStrikes = data.lastStrikeByUnit || {};
      const totalStrikes = data.strikes || 0;
      const pendingUnits = data.pendingUnits || []; // Новый массив с ожидаемыми

      document.getElementById("strike-total").textContent = totalStrikes;
      const container = document.getElementById("unit-strike-list");
      container.innerHTML = "";

      Units.forEach(unit => {
        const div = document.createElement("div");
        div.className = "unit-strike-item";
        div.textContent = `Unit ${unit}`;

        if (lastStrikes[unit]) {
          div.classList.add("strike");
        } else if (pendingUnits.includes(unit)) {
          div.classList.add("pending");
        }

        container.appendChild(div);
      });
    })
    .catch(err => {
      console.error("Ошибка при получении strike истории:", err);
    });
});



    // Smooth scroll to bottom
    function scrollToBottom() {
      messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
    }

    // Create custom video player
    function createCustomVideoPlayer(videoUrl) {
      const player = document.createElement('div');
      player.classList.add('custom-video-player');

      const video = document.createElement('video');
      video.classList.add('video-element');
      video.src = videoUrl;
      video.preload = 'metadata';

      const controls = document.createElement('div');
      controls.classList.add('controls');

      const playBtn = document.createElement('button');
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      playBtn.setAttribute('aria-label', 'Play/Pause video');

      const progressBar = document.createElement('input');
      progressBar.type = 'range';
      progressBar.classList.add('progress-bar');
      progressBar.value = 0;
      progressBar.setAttribute('aria-label', 'Video progress');

      const timeDisplay = document.createElement('span');
      timeDisplay.classList.add('time');
      timeDisplay.textContent = '00:00';

      controls.appendChild(playBtn);
      controls.appendChild(progressBar);
      controls.appendChild(timeDisplay);
      player.appendChild(video);
      player.appendChild(controls);

      let hideControlsTimeout;
      function resetControlsTimeout() {
        clearTimeout(hideControlsTimeout);
        controls.style.opacity = '1';
        hideControlsTimeout = setTimeout(() => {
          controls.style.opacity = '0';
        }, 3000);
      }

      player.addEventListener('mousemove', resetControlsTimeout);
      video.addEventListener('play', resetControlsTimeout);
      video.addEventListener('pause', resetControlsTimeout);

      playBtn.addEventListener('click', () => {
        if (video.paused) {
          video.play();
          playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
          video.pause();
          playBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
      });

      video.addEventListener('timeupdate', () => {
        const progress = (video.currentTime / video.duration) * 100;
        progressBar.value = progress;
        const minutes = Math.floor(video.currentTime / 60);
        const seconds = Math.floor(video.currentTime % 60);
        timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      });

      progressBar.addEventListener('input', () => {
        video.currentTime = (progressBar.value / 100) * video.duration;
      });

      return player;
    }

    // Create custom audio player
    function createCustomAudioPlayer(audioUrl, filename) {
      const player = document.createElement('div');
      player.classList.add('custom-audio-player');

      const audio = document.createElement('audio');
      audio.src = audioUrl;
      audio.preload = 'metadata';

      const maxLength = 20;
      const displayFilename = filename.length > maxLength ? filename.substring(0, maxLength - 3) + '...' : filename;

      const playBtn = document.createElement('button');
      playBtn.classList.add('custom-play-btn');
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      playBtn.setAttribute('aria-label', 'Play/Pause audio');

      const waves = document.createElement('div');
      waves.classList.add('custom-audio-waves');
      const progress = document.createElement('div');
      progress.classList.add('progress');
      waves.appendChild(progress);

      const timeDisplay = document.createElement('span');
      timeDisplay.classList.add('custom-time-display');
      timeDisplay.textContent = '00:00';

      const filenameDisplay = document.createElement('span');
      filenameDisplay.classList.add('custom-filename');
      filenameDisplay.textContent = displayFilename;

      player.appendChild(filenameDisplay);
      player.appendChild(playBtn);
      player.appendChild(waves);
      player.appendChild(timeDisplay);

      let hideControlsTimeout;
      function resetControlsTimeout() {
        clearTimeout(hideControlsTimeout);
        playBtn.style.opacity = '1';
        waves.style.opacity = '1';
        timeDisplay.style.opacity = '1';
        hideControlsTimeout = setTimeout(() => {
          playBtn.style.opacity = '0.7';
          waves.style.opacity = '0.7';
          timeDisplay.style.opacity = '0.7';
        }, 3000);
      }

      player.addEventListener('mousemove', resetControlsTimeout);
      audio.addEventListener('play', resetControlsTimeout);
      audio.addEventListener('pause', resetControlsTimeout);

      playBtn.addEventListener('click', () => {
        if (audio.paused) {
          audio.play();
          playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
          audio.pause();
          playBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
      });

      audio.addEventListener('timeupdate', () => {
        const progressWidth = (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${progressWidth}%`;
        const minutes = Math.floor(audio.currentTime / 60);
        const seconds = Math.floor(audio.currentTime % 60);
        timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      });

      return player;
    }

    // Create message element
    function createMessageElement(message) {
      const messageElement = document.createElement('div');
      messageElement.classList.add('message', message.username === currentUser ? 'user' : 'bot');

      const header = document.createElement('div');
      header.classList.add('message-header');

      const avatarContainer = document.createElement('div');
      avatarContainer.classList.add('avatar-container');

      const avatarPlaceholder = document.createElement('div');
      avatarPlaceholder.classList.add('avatar-placeholder');
      avatarPlaceholder.textContent = message.username.charAt(0).toUpperCase();
      avatarContainer.appendChild(avatarPlaceholder);

      fetch(`/get_avatar/${message.username}`)
        .then(res => res.json())
        .then(data => {
          avatarContainer.innerHTML = '';
          if (data.avatar_url) {
            const avatarImg = document.createElement('img');
            avatarImg.src = data.avatar_url;
            avatarImg.alt = message.username;
            avatarImg.classList.add('avatar-image');
            avatarContainer.appendChild(avatarImg);
          } else {
            avatarContainer.appendChild(avatarPlaceholder);
          }
        })
        .catch(() => {
          avatarContainer.innerHTML = '';
          avatarContainer.appendChild(avatarPlaceholder);
        });

      const usernameElement = document.createElement('span');
      usernameElement.classList.add('message-username');
      usernameElement.textContent = message.username;

      const timestampElement = document.createElement('span');
      timestampElement.classList.add('message-timestamp');
      timestampElement.textContent = message.timestamp || new Date().toLocaleTimeString();

      header.appendChild(avatarContainer);
      header.appendChild(usernameElement);
      header.appendChild(timestampElement);

      const content = document.createElement('div');
      content.classList.add('message-content');

      if (message.type === 'text') {
        content.textContent = message.text;
      } else if (message.type === 'file') {
        if (message.filename.match(/\.(jpeg|jpg|gif|png)$/i)) {
          const imageWrapper = document.createElement('div');
          const imgLoadingSpinner = document.createElement('div');
          imgLoadingSpinner.classList.add('lds-dual-ring');
          content.appendChild(imgLoadingSpinner);

          const image = document.createElement('img');
          image.src = message.url;
          image.alt = message.filename;
          image.classList.add('message-image');
          image.style.display = 'none';

          image.onload = () => {
            imgLoadingSpinner.style.display = 'none';
            image.style.display = 'block';
          };

          image.onerror = () => {
            imgLoadingSpinner.style.display = 'none';
            content.textContent = 'Error loading image';
          };

          imageWrapper.appendChild(image);
          content.appendChild(imageWrapper);
        } else if (message.filename.match(/\.(mp4|webm|ogg)$/i)) {
          const customPlayer = createCustomVideoPlayer(message.url);
          content.appendChild(customPlayer);
        } else if (message.filename.match(/\.(mp3|mpeg)$/i)) {
          const customPlayer = createCustomAudioPlayer(message.url, message.filename);
          content.appendChild(customPlayer);
        }
      }

      messageElement.appendChild(header);
      messageElement.appendChild(content);
      return messageElement;
    }

	// Helper to create chat item elements
function createChatItem(chatId, title, iconClass, previewText) {
  const item = document.createElement('div');
  item.classList.add('chat-item');
  item.dataset.chat = chatId;

  const icon = document.createElement('i');
  icon.className = iconClass;
  item.appendChild(icon);

  const info = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = title;
  const p = document.createElement('p');
  p.textContent = previewText;
  info.appendChild(strong);
  info.appendChild(p);

  item.appendChild(info);

  // On click, open this chat
  item.addEventListener('click', () => {
    currentChatId = chatId;
    // Update header title
    document.querySelector('#chat-ui .header .title').textContent = title;
    // Load messages for this chat
    socket.emit('join_chat', chatId, () => {
      socket.emit('load_messages', chatId);
    });
    // Show chat UI
    showPage('chat-ui');
  });

  return item;
}

// Load public and personal chats into the list
function loadChatList() {
  const chatListContainer = document.querySelector('#chat-list .chat-list');
  chatListContainer.innerHTML = '';

  // Public group chat
  const publicChat = createChatItem(
    'group-General',
    'My Group - General',
    'fas fa-users',
    'No message'
  );
  chatListContainer.appendChild(publicChat);

  // Fetch all users for private chats
  fetch('/api/users')
    .then(res => res.json())
    .then(users => {
      users.forEach(user => {
        // Skip current user
        if (user.username === currentUser) return;

        const chatId = `private-${user.username}`;
        const personalChat = createChatItem(
          chatId,
          user.username,
          'fas fa-user',
          'No message'
        );
        chatListContainer.appendChild(personalChat);
      });
    })
    .catch(err => console.error('Error loading users:', err));
}

    // Load messages
    socket.on('load_messages', (loadedMessages) => {
      messagesDiv.innerHTML = '';
      if (loadedMessages.length === 0) {
        const noMessages = document.createElement('div');
        noMessages.classList.add('no-messages');
        noMessages.innerHTML = '<i class="fas fa-comments"></i><p>No Messages</p><p>Start chatting with groupmates</p>';
        messagesDiv.appendChild(noMessages);
      } else {
        loadedMessages.forEach(message => {
          messagesDiv.appendChild(createMessageElement(message));
        });
        scrollToBottom();
        const lastMessage = loadedMessages[loadedMessages.length - 1];
        updateChatItemPreview(currentChatId, lastMessage);
      }
    });

    // New message
    socket.on('new_message', (message) => {
      const noMessages = messagesDiv.querySelector('.no-messages');
      if (noMessages) noMessages.remove();
      messagesDiv.appendChild(createMessageElement(message));
      scrollToBottom();
      updateChatItemPreview(currentChatId, message);
    });

    // Debounce function
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    // Send message
    function sendMessage() {
      const text = messageInput.value.trim();
      if (text) {
        socket.emit('send_message', { username: currentUser, text, type: 'text', chatId: currentChatId });
        messageInput.value = '';
      }
    }

    const debouncedSendMessage = debounce(sendMessage, 200);

    messageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      debouncedSendMessage();
    });

    sendButton.addEventListener('click', (e) => {
      e.preventDefault();
      debouncedSendMessage();
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        debouncedSendMessage();
      }
    });

    // File upload
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;

      const validTypes = [
        'image/jpeg', 'image/jpg', 'image/gif', 'image/png',
        'video/mp4', 'video/webm', 'video/ogg',
        'audio/mpeg', 'audio/mp3'
      ];

      if (!validTypes.includes(file.type)) {
        const errorDiv = document.createElement('div');
        errorDiv.classList.add('error-message');
        errorDiv.textContent = 'Invalid file type. Please upload images, videos, or MP3 files.';
        messagesDiv.appendChild(errorDiv);
        fileInput.value = '';
        return;
      }

      const form = new FormData();
      form.append('file', file);

      fetch('/upload', {
        method: 'POST',
        body: form
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            fileInput.value = '';
          } else {
            throw new Error(data.error || 'Upload failed');
          }
        })
        .catch(err => {
          const errorDiv = document.createElement('div');
          errorDiv.classList.add('error-message');
          errorDiv.textContent = err.message;
          messagesDiv.appendChild(errorDiv);
        });
    });

    // Navigation
    navLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        showPage(link.dataset.page);
      });
    });

    chatItems.forEach(item => {
      item.addEventListener('click', () => {
        currentChatId = item.dataset.chat;
        showPage('chat-ui');
        socket.emit('load_messages', { chatId: currentChatId });
      });
    });

    backBtn.addEventListener('click', () => showPage('chat-list'));

    avatar.addEventListener('click', () => showPage('profile'));
    profileAvatar.addEventListener('click', () => showPage('profile'));

    window.addEventListener('popstate', () => {
      const id = location.pathname.replace('/', '') || 'main';
      showPage(id);
    });

    // Update chat item preview
    function updateChatItemPreview(chatId, message) {
      const chatItem = document.querySelector(`.chat-item[data-chat="${chatId}"]`);
      if (chatItem) {
        const preview = chatItem.querySelector('p');
        if (message.type === 'text') {
          preview.textContent = message.text.length > 20 ? message.text.substring(0, 17) + '...' : message.text;
        } else if (message.type === 'file') {
          preview.textContent = message.filename.length > 20 ? message.filename.substring(0, 17) + '...' : message.filename;
        }
      }
    }

    // Load balance
    fetch(`/api/get_balance/${currentUser}`, { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        if (data.balance !== undefined) {
          balanceAmount.textContent = `${data.balance} Points`;
          balanceStatus.textContent = data.balance >= 0 ? 'Paid' : 'Debtor';
          balanceStatus.className = data.balance >= 0 ? 'Paid' : 'Debtor';
		  
if (data.balance >= 0) {
  accountStatus = 'Paid';
} else {
  accountStatus = 'Debtor';
}
if (accountStatus === 'Debtor') {
  // Отключаем переход по вкладкам
  document.querySelectorAll('nav a[data-page="chat-list"], nav a[data-page="progress"]').forEach(link => {
    link.classList.add('disabled');
    link.addEventListener('click', e => {
      e.preventDefault();
    });
  });

  // Отключаем Coin Shop карточки
  document.querySelectorAll('.coin-shop-card').forEach(card => {
    card.classList.add('disabled');
    card.addEventListener('click', e => {
      e.preventDefault();
	  showModalStatus("Your account is restricted due to insufficient balance.","failed");
      showToastNotification("Your account is restricted due to insufficient balance.", 'error');
    });
  });
document.querySelectorAll('.progress-item.coins').forEach(el => {
  el.classList.add('disabled');

  el.addEventListener('click', e => {
    e.preventDefault();
    showModalStatus("Your account is restricted due to insufficient balance.", "failed");
  });
});

}


        }
      });

    // Change avatar functionality
    changeAvatarBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('username', currentUser);

        fetch('/upload_avatar', {
          method: 'POST',
          body: formData
        })
          .then(res => res.json())
          .then(data => {
            if (data.avatar_url) {
              avatar.src = data.avatar_url;
              profileAvatar.src = data.avatar_url;
              avatar.style.display = 'block';
              profileAvatar.style.display = 'block';
              avatarInput.value = '';
            }
          })
          .catch(err => {
            console.error('Avatar upload failed:', err);
          });
      }
    });

    // Utility function to get current user
    function getCurrentUser() {
      return currentUser;
    }

    // Function to calculate next exam date
// Declare globals to store current student level and unit
let currentLevel = null;
let currentUnit  = null;
let activeCurrentUnit = null;

function getNextExamDate(unit, startDate, studyDays) {
  console.log('📅 getNextExamDate called with:');
  console.log('   ➤ unit:', unit);
  console.log('   ➤ startDate:', startDate);
  console.log('   ➤ studyDays:', studyDays);

  const currentDate = new Date();
  let baseDate = startDate ? new Date(startDate) : currentDate;
  baseDate.setHours(0, 0, 0, 0);

  // 🔹 Константы
  const daysPerUnit = 3;
  const midExamDays = 6 * daysPerUnit;     // After Unit 6.3
  const finalExamDays = 12 * daysPerUnit;  // After Unit 12.3

  // 🔹 Разбор текущего Unit
  const [week, day] = unit.split('.').map(Number);
  const currentStudyDays = (week - 1) * daysPerUnit + day;

  console.log('   ➤ week:', week, 'day:', day);
  console.log('   ➤ currentStudyDays:', currentStudyDays);

  // 🔹 Разрешённые учебные дни
  const oddDays = [1, 3, 5];   // Mon, Wed, Fri
  const evenDays = [2, 4, 6];  // Tue, Thu, Sat
  const allowedDays = studyDays === "even" ? evenDays : oddDays;

  // 🔹 Вспомогательная функция: найти дату экзамена после N учебных дней
  function calculateExamDate(targetDays) {
    let count = 0;
    let temp = new Date(baseDate);

    // Найдём первый разрешённый учебный день
    while (!allowedDays.includes(temp.getDay())) {
      temp.setDate(temp.getDate() + 1);
    }

    while (count < targetDays) {
      if (allowedDays.includes(temp.getDay())) {
        count++;
      }
      temp.setDate(temp.getDate() + 1);
    }

    const readable = temp.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log(`   ✅ Target ${targetDays} study days reached: ${readable}`);
    return readable;
  }

  // 🔹 Решаем, какой экзамен следующий
  if (currentStudyDays < midExamDays) {
    console.log('   ➤ Mid Term is next');
    return calculateExamDate(midExamDays);
  } else if (currentStudyDays < finalExamDays) {
    console.log('   ➤ Final Exam is next');
    return calculateExamDate(finalExamDays);
  } else {
    console.log('   🚫 Course finished, no upcoming exams');
    return "No upcoming exams";
  }
}




function getNextLevel(currentLevel) {
  const levels = ['Beginner', 'Elementary', 'Pre-intermediate', 'IELTS L1', 'IELTS L2'];
  const currentIndex = levels.indexOf(currentLevel);
  if (currentIndex === -1 || currentIndex === levels.length - 1) {
    return currentLevel;
  }
  return levels[currentIndex + 1];
}

const Units = [
  "1.1", "1.2", "1.3",
  "2.1", "2.2", "2.3",
  "3.1", "3.2", "3.3",
  "4.1", "4.2", "4.3",
  "5.1", "5.2", "5.3",
  "6.1", "6.2", "6.3",
  "7.1", "7.2", "7.3",
  "8.1", "8.2", "8.3",
  "9.1", "9.2", "9.3",
  "10.1", "10.2", "10.3",
  "11.1", "11.2", "11.3",
  "12.1", "12.2", "12.3"
];

function fetchStudentProgress() {
  let currentView = "progress";
  const username = getCurrentUser();
  const errorMessageEl = document.getElementById("error-message");
  const progressCard = document.getElementById("progress-card");
  const progressContainer = document.getElementById("progress-container");
  const loadingEl = document.getElementById("loading");
  const fixedTableHead = document.getElementById("leaderboard-fixed-table-head");
  const fixedTableBody = document.getElementById("leaderboard-fixed-table-body");
  const unitsTableHead = document.getElementById("leaderboard-units-table-head");
  const unitsTableBody = document.getElementById("leaderboard-units-table-body");
  const toggleProgress = document.getElementById("toggle-progress");
  const toggleToday = document.getElementById("toggle-today");
  const skeletonCard = document.getElementById("progress-card-skeleton");

  if (skeletonCard) skeletonCard.style.display = "flex";

  errorMessageEl.style.display = "none";
  progressCard.style.display = "none";
  progressContainer.style.display = "none";
  loadingEl.style.display = "flex";

function updateTableHeaders(view) {
  if (view === "progress") {
    fixedTableHead.innerHTML = `
      <tr>
        <th>Rank</th>
        <th>Name</th>
        <th>Progress</th>
      </tr>
    `;
    unitsTableHead.innerHTML = '';
  } else if (view === "today") {
    fixedTableHead.innerHTML = `
      <tr>
        <th>Rank</th>
        <th>Name</th>
        <th>Today</th>
      </tr>
    `;

    // Определяем индекс текущего юнита
    const currentUnitIndex = Units.indexOf(currentUnit);

    // Обрезаем Units только до текущего юнита включительно
    const relevantUnits = currentUnitIndex >= 0
      ? Units.slice(0, currentUnitIndex + 1)
      : [];

    // Генерация строк заголовков
    const headerRow = document.createElement('tr');
    relevantUnits.forEach(unit => {
      const th = document.createElement('th');
      th.textContent = `Unit ${unit}`;
      headerRow.appendChild(th);
    });

    // Обновляем заголовок таблицы
    unitsTableHead.innerHTML = '';
    unitsTableHead.appendChild(headerRow);
  }
}


  function updateLeaderboard(view, data, historyData) {
    fixedTableBody.innerHTML = "";
    unitsTableBody.innerHTML = "";
    updateTableHeaders(view);

    if (view === "progress") {
      const sortedLeaderboard = Object.entries(data)
        .sort(([, a], [, b]) => b.progress - a.progress);

      sortedLeaderboard.forEach(([student, studentInfo], index) => {
        const fixedRow = document.createElement('tr');
        const formattedProgress = parseFloat(studentInfo.progress).toFixed(2);
        let progressHtml = `${formattedProgress}%`;

        if (student === username && historyData.length >= 2) {
          const weeklyHistory = historyData.filter(item => item.weeklyExams !== undefined);
          if (weeklyHistory.length >= 2) {
            weeklyHistory.sort((a, b) => b.date.localeCompare(a.date));
            let distinct = [];
            for (let rec of weeklyHistory) {
              if (!distinct.length || rec.date !== distinct[distinct.length - 1].date) {
                distinct.push(rec);
              }
              if (distinct.length === 2) break;
            }
            if (distinct.length === 2) {
              const [mostRecent, previous] = distinct;
              const currentWeekly = parseFloat(mostRecent.weeklyExams);
              const previousWeekly = parseFloat(previous.weeklyExams);
              if (currentWeekly > previousWeekly) {
                progressHtml = `<span class="up-percentage"><i class="fas fa-arrow-up up-icon"></i> ${formattedProgress}%</span>`;
              } else if (currentWeekly < previousWeekly) {
                progressHtml = `<span class="down-percentage"><i class="fas fa-arrow-down down-icon"></i> ${formattedProgress}%</span>`;
              }
            }
          }
        }

        fixedRow.innerHTML = `
          <td><div class="student-avatar">${index + 1}</div></td>
          <td class="student-name">${student}</td>
          <td>${progressHtml}</td>
        `;
        fixedTableBody.appendChild(fixedRow);
        unitsTableBody.appendChild(document.createElement('tr'));
      });
    } else if (view === "today") {
      const currentUnitIndex = Units.indexOf(currentUnit);
const relevantUnits = currentUnitIndex >= 0
  ? Units.slice(0, currentUnitIndex + 1)
  : [];

      const sortedToday = Object.entries(data).map(([student, info]) => {
        const unitPercentages = {};
        relevantUnits.forEach(unit => {
          const tasks = info.tasks.filter(t => t.unit === unit);
          unitPercentages[unit] = tasks.length
            ? tasks.reduce((sum, t) => sum + t.percent, 0) / tasks.length
            : 0;
        });
        const average_percent = relevantUnits.reduce((sum, u) => sum + unitPercentages[u], 0) / relevantUnits.length;
        return [student, { ...info, unitPercentages, average_percent }];
      }).filter(([, info]) => info.average_percent > 0)
        .sort(([, a], [, b]) => b.average_percent - a.average_percent);

      if (sortedToday.length === 0) {
        fixedTableBody.innerHTML = `
          <tr><td colspan="3" style="text-align: center;">No results for today</td></tr>`;
        unitsTableBody.innerHTML = `
          <tr><td colspan="${relevantUnits.length}" style="text-align: center;"></td></tr>`;
      } else {
        sortedToday.forEach(([student, info], index) => {
          const fixedRow = document.createElement('tr');
          fixedRow.innerHTML = `
            <td><div class="student-avatar">${index + 1}</div></td>
            <td class="student-name">${student}</td>
            <td>${info.average_percent.toFixed(2)}%</td>
          `;
          fixedTableBody.appendChild(fixedRow);

          if (student === username) {
            fetch('/api/update-history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: username,
                averagePercent: info.average_percent
              })
            }).then(r => r.ok ? r.json() : Promise.reject(r.statusText))
              .then(console.log)
              .catch(e => console.error('Update-history error:', e));
          }

          const unitsRow = document.createElement('tr');
          unitsRow.innerHTML = relevantUnits
            .map(unit => `<td>${info.unitPercentages[unit].toFixed(2)}%</td>`)
            .join('');
          unitsTableBody.appendChild(unitsRow);
        });
      }
    }

    progressContainer.style.display = "block";
    loadingEl.style.display = "none";
  }

  updateTableHeaders("progress");

  fixedTableBody.innerHTML = `
    <tr><td colspan="3" class="loading-spinner">
      <div class="lds-spinner">${'<div></div>'.repeat(12)}</div>
    </td></tr>`;
  unitsTableBody.innerHTML = `
    <tr><td colspan="${Units.indexOf(activeCurrentUnit) + 1}" class="loading-spinner"></td></tr>`;

  const progressPromise = fetch(`/api/get-student-progress?username=${username}`).then(r => r.ok ? r.json() : r.json().then(data => { throw new Error(data.error); }));
  const progressHistoryPromise = fetch(`/api/get-student-progress-history?username=${username}`).then(r => r.ok ? r.json() : r.json().then(data => { throw new Error(data.error); }));
  const todayResultsPromise = fetch(`/api/get-results/today?level=${currentLevel}`).then(r => r.ok ? r.json() : r.json().then(data => { throw new Error(data.error); }));

  Promise.all([progressPromise, progressHistoryPromise, todayResultsPromise])
    .then(([progressData, progressHistoryData, todayResultsData]) => {
      const progressInfo = progressData[username] || {};
      const summaryInfo = progressHistoryData[username] || {};

      progressInfo.finalExam = parseFloat(summaryInfo.finalExam || "0").toFixed(2);
      progressInfo.weeklyExams = parseFloat(summaryInfo.weeklyExams || "0").toFixed(2);
      progressInfo.totalScore = parseFloat(summaryInfo.totalScore || "0").toFixed(2);
      progressInfo.level = summaryInfo.level || progressInfo.level || 'Beginner';
      progressInfo.coins = progressInfo.coins || 0;
      progressInfo.points = progressInfo.points || 0;
      progressInfo.leaderboardRank = progressInfo.leaderboardRank || '#--';
      progressInfo.strikeDays = progressInfo.strikeDays || 0;

      const { progress = 0, start_date, study_days = "odd", finalExam, weeklyExams, level, coins, points, leaderboardRank, strikeDays } = progressInfo;
      if (!start_date) throw new Error("Start date is missing");

      const currentDate = new Date();
      currentDate.setHours(17, 32, 0, 0);
      const courseStartDate = new Date(start_date);
      const daysElapsed = Math.floor((currentDate - courseStartDate) / (1000 * 60 * 60 * 24)) + 1;
      const completionPercentage = Math.round(Math.min((daysElapsed / 90) * 100, 100));

      const oddDays = [1, 3, 5];
      const evenDays = [2, 4, 6];
      let studyDaysElapsed = 0;
      let tempDate = new Date(courseStartDate);

      while (!((study_days === "odd" && oddDays.includes(tempDate.getDay())) ||
               (study_days === "even" && evenDays.includes(tempDate.getDay())))) {
        tempDate.setDate(tempDate.getDate() + 1);
      }

      const firstStudyDate = new Date(tempDate);
      tempDate = new Date(firstStudyDate);
      while (tempDate <= currentDate) {
        if ((study_days === "odd" && oddDays.includes(tempDate.getDay())) ||
            (study_days === "even" && evenDays.includes(tempDate.getDay()))) {
          studyDaysElapsed++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }

      const studyWeeksElapsed = Math.floor((studyDaysElapsed - 1) / 3);
      const dayInWeek = ((studyDaysElapsed - 1) % 3) + 1;
      const unit = `${studyWeeksElapsed + 1}.${dayInWeek}`;
      const weekNumber = studyWeeksElapsed + 1;
      const nextExamDate = getNextExamDate(unit, start_date, study_days);

      currentLevel = level;
      currentUnit = unit;
      activeCurrentUnit = unit;

      updateStrikes();
      generateTodayTasks(currentLevel, currentUnit);

      if (skeletonCard) skeletonCard.style.display = "none";
      if (progressCard) progressCard.style.display = "flex";

      document.getElementById("current-level-value").textContent = level;
      document.getElementById("next-level-label").textContent = `Next: ${getNextLevel(level)}`;
      document.getElementById("current-unit-value").textContent = `Unit ${unit}`;
      document.getElementById("current-week-value").textContent = `Week ${weekNumber}`;
      document.getElementById("completion-value").textContent = `${completionPercentage}%`;
      document.getElementById("coins-value").textContent = coins;
      document.getElementById("points-value").textContent = `${points}`;
      document.getElementById("leaderboard-value").textContent = leaderboardRank;
      document.getElementById("strike-value").textContent = strikeDays > 0 ? `${strikeDays} day${strikeDays > 1 ? 's' : ''}` : 'None';
      document.getElementById("current-level").textContent = `Level: ${level}`;
      document.getElementById("progress-score").textContent = `Total Score: ${parseFloat(progress).toFixed(2)}%`;
      document.getElementById("progress-bar-fill").style.width = `${parseFloat(progress).toFixed(2)}%`;

      const finalExamPercent = ((parseFloat(finalExam) / 30) * 100).toFixed(2);
      document.getElementById("finalExamLabel").textContent = `${finalExam} / 30 (${finalExamPercent}%)`;
      const finalExamBar = document.getElementById("progressFinalExamBar");
      if (finalExamBar) finalExamBar.style.width = `${finalExamPercent}%`;

      const studentTodayInfo = todayResultsData[username];
      let todayAverage = 0;

      if (studentTodayInfo && studentTodayInfo.tasks) {
        const unitPercentages = {};
        Units.forEach(unit => {
          const tasks = studentTodayInfo.tasks.filter(t => t.unit === unit);
          unitPercentages[unit] = tasks.length
            ? tasks.reduce((sum, t) => sum + t.percent, 0) / tasks.length
            : 0;
        });

        todayAverage = Units.reduce((sum, unit) => sum + unitPercentages[unit], 0) / Units.length;
        todayAverage = parseFloat(todayAverage.toFixed(2));
      }

      const todayPercent = ((todayAverage / 70) * 100).toFixed(2);
      document.getElementById("todayLabel").textContent = `${todayAverage.toFixed(2)} / 70 (${todayPercent}%)`;
      const todayBar = document.getElementById("progressTodayBar");
      if (todayBar) todayBar.style.width = `${todayPercent}%`;

      const examMessage = weekNumber <= 6
        ? `Mid Term Exam: ${nextExamDate}`
        : `Final Exam: ${nextExamDate}`;
      const examIcon = weekNumber <= 6
        ? '<i class="fas fa-calendar-day"></i>'
        : '<i class="fas fa-calendar-check"></i>';
      document.getElementById("exam-date").innerHTML = `${examIcon} ${examMessage}`;

      document.getElementById("current-unit").textContent = `Unit ${unit}`;
      document.getElementById("current-week").textContent = `Week ${weekNumber}`;
      document.getElementById("course-completion").textContent = `${completionPercentage}% Completed`;

      return fetch('/api/get-leaderboard')
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch leaderboard');
          return response.json();
        })
        .then(leaderboardData => ({ leaderboardData, todayResultsData }));
    })
    .then(({ leaderboardData, todayResultsData }) =>
      fetch(`/api/get-history?username=${username}`)
        .then(r => r.ok ? r.json() : [])
        .then(historyData => ({ leaderboardData, historyData, todayResultsData }))
    )
    .then(({ leaderboardData, historyData, todayResultsData }) => {
      updateLeaderboard("progress", leaderboardData, historyData);

      toggleProgress.addEventListener('click', () => {
        if (currentView !== "progress") {
          currentView = "progress";
          toggleProgress.classList.add('active');
          toggleToday.classList.remove('active');
          loadingEl.style.display = "flex";
          fixedTableBody.innerHTML = `<tr><td colspan="3" class="loading-spinner"><div class="lds-spinner">${'<div></div>'.repeat(12)}</div></td></tr>`;
          unitsTableBody.innerHTML = '';
          fetch('/api/get-leaderboard')
            .then(r => r.ok ? r.json() : Promise.reject('Leaderboard error'))
            .then(newLeaderboard => updateLeaderboard("progress", newLeaderboard, historyData))
            .catch(e => {
              errorMessageEl.textContent = "Failed to load leaderboard";
              errorMessageEl.style.display = "block";
              loadingEl.style.display = "none";
              console.error(e);
            });
        }
      });

      toggleToday.addEventListener('click', () => {
        if (currentView !== "today") {
          currentView = "today";
          toggleToday.classList.add('active');
          toggleProgress.classList.remove('active');
          loadingEl.style.display = "flex";
          fixedTableBody.innerHTML = `<tr><td colspan="3" class="loading-spinner"><div class="lds-spinner">${'<div></div>'.repeat(12)}</div></td></tr>`;
          unitsTableBody.innerHTML = `<tr><td colspan="${Units.indexOf(activeCurrentUnit) + 1}" class="loading-spinner"></td></tr>`;
          fetch(`/api/get-results/today?level=${currentLevel}`)
            .then(r => r.ok ? r.json() : Promise.reject('Today error'))
            .then(newToday => updateLeaderboard("today", newToday, historyData))
            .catch(e => {
              errorMessageEl.textContent = "Failed to load today's leaderboard";
              errorMessageEl.style.display = "block";
              loadingEl.style.display = "none";
              console.error(e);
            });
        }
      });
    })
    .catch(err => {
      console.warn("⚠️ Student not active:", err.message);
      if (skeletonCard) skeletonCard.style.display = "none";
      if (progressCard) progressCard.style.display = "none";
      progressContainer.style.display = "none";
      loadingEl.style.display = "none";
      errorMessageEl.innerHTML = `
        <div class="glass-error">
          <div class="icon"><i class="fas fa-user-slash"></i></div>
          <strong>You are not an active student</strong><br>
          <span>Join the course or <a href="https://t.me/SAV571420" target="_blank">Support Center</a> to activate your account.</span>
        </div>
      `;
      errorMessageEl.style.display = "block";
    })
    .finally(() => {
      loadingEl.style.display = "none";
    });
}


// Stub for generating tasks — replace with actual implementation
function generateTodayTasks(level, unit) {
  console.log(`📘 Generating tasks for Level: ${level}, Unit: ${unit}`);
  // Example: fetch(`/api/get-tasks?level=${level}&unit=${unit}`)...
}
	
function fetchLeaderboardRank(username) {
    const leaderboardValue = document.getElementById("leaderboard-value");
    const progressCard = document.getElementById("progress-card");

    if (!leaderboardValue || !progressCard) return;

    const mainPage = document.getElementById("main");
    if (!mainPage.classList.contains("active")) return;

    const updateLeaderboardValue = () => {
        const cachedRank = sessionStorage.getItem('userRank');
        if (cachedRank) {
            leaderboardValue.innerText = `#${cachedRank}`;
            return true;
        }

        fetch('/api/leaderboard')
            .then(response => {
                if (!response.ok) throw new Error();
                return response.json();
            })
            .then(data => {
                if (!username) {
                    leaderboardValue.innerText = `#?`;
                    return;
                }

                let allPlayers = [...data.top_3, ...data.others];
                let userRank = allPlayers.findIndex(player => player.name.trim().toLowerCase() === username.toLowerCase()) + 1;

                if (userRank > 0) {
                    leaderboardValue.innerText = `#${userRank}`;
                    sessionStorage.setItem('userRank', userRank);
                } else {
                    leaderboardValue.innerText = `#?`;
                    sessionStorage.setItem('userRank', '?');
                }
            })
            .catch(() => {
                leaderboardValue.innerText = `#?`;
                sessionStorage.setItem('userRank', '?');
            });

        return false;
    };

    if (progressCard.style.display !== "none") {
        updateLeaderboardValue();
    } else {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === "style" && progressCard.style.display !== "none") {
                    updateLeaderboardValue();
                    observer.disconnect();
                }
            });
        });
        observer.observe(progressCard, { attributes: true });
    }
}
    // Initial load
    showPage('main');
	
document
  .querySelector('.progress-item.leaderboard-trigger')
  .addEventListener('click', () => {
    currentChatId = 'leaderboard';
    showPage('leaderboard');
  });

async function updateStrikes() {
  try {
    // 1) Получаем средний процент + submitted_count и total_tasks, передаём username
    const avgUrl = `/api/get-results/average`
      + `?level=${encodeURIComponent(currentLevel)}`
      + `&unit=${encodeURIComponent(currentUnit)}`
      + `&username=${encodeURIComponent(currentUser)}`;
    const avgRes = await fetch(avgUrl);
    if (!avgRes.ok) throw new Error(avgRes.statusText);
    const avgData = await avgRes.json();

    const stats = avgData[username] || {
      average_percent: 0,
      submitted_count: 0,
      total_tasks: 0
    };
    const unitPercent    = stats.average_percent;
    const submittedCount = stats.submitted_count;
    const totalTasks     = stats.total_tasks;

    // 2) Отправляем на сервер данные для начисления или сброса штрихов
    const strikeRes = await fetch('/api/check-strike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username:        username,
        currentUnit:     currentUnit,
        unitPercent:     unitPercent,
        submittedCount:  submittedCount,
        totalTasks:      totalTasks
      })
    });
    if (!strikeRes.ok) throw new Error(strikeRes.statusText);
    const { strikes } = await strikeRes.json();

    // 3) Обновляем UI
    const text = strikes > 0
      ? `${strikes} Strike${strikes > 1 ? 's' : ''}`
      : '0 Strike';
    document.getElementById("strike-value").textContent = text;

  } catch (e) {
    console.error('Failed to update strikes:', e);
  }
}


async function fetchAvatar(name) {
    // Попытка загрузить изображение, если не найдено — показать первую букву
    try {
        const response = await fetch(`/avatars/${encodeURIComponent(name)}.png`);
        if (response.ok) {
            return `<img src="/avatars/${name}.png" alt="${name}'s avatar" />`;
        } else {
            throw new Error('Avatar not found');
        }
    } catch {
        const firstLetter = name.charAt(0).toUpperCase();
        return `<div class="avatar-placeholder">${firstLetter}</div>`;
    }
}

// Обновить таблицу лидеров
async function updateLeaderboardUI(mode = 'points') {
  const leaderboardContainer = document.getElementById('leaderboard-container');
  if (!leaderboardContainer) return;

  // Скелетон загрузки
  leaderboardContainer.innerHTML = `
    <div class="leaderboard-loading">
      <div class="skeleton skeleton-title"></div>

      <div class="skeleton-top-3">
        <div class="skeleton-top-player">
          <div class="skeleton skeleton-avatar-top"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line" style="width: 40px;"></div>
        </div>
        <div class="skeleton-top-player">
          <div class="skeleton skeleton-avatar-top"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line" style="width: 40px;"></div>
        </div>
        <div class="skeleton-top-player">
          <div class="skeleton skeleton-avatar-top"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line" style="width: 40px;"></div>
        </div>
      </div>

      <div class="skeleton skeleton-list"></div>
      <div class="skeleton skeleton-list"></div>
      <div class="skeleton skeleton-list"></div>
    </div>
  `;

  const endpoint = mode === 'strikes'
    ? '/api/leaderboard-strikes'
    : '/api/leaderboard';

const iconHtml = mode === 'strikes'
  ? '<i class="fas fa-fire" style="color:#ff4d4d;"></i> Strikes'
  : '<i class="fas fa-star"></i>';


  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();

    const allPlayers = [...data.top_3, ...data.others];
    const sorted = allPlayers.sort((a, b) =>
      mode === 'strikes' ? b.strikes - a.strikes : b.coins - a.coins
    );

    const top3 = sorted.slice(0, 3);
    const others = sorted.slice(3);

    let html = `
      <div class="leaderboard">
        <button class="back-button" onclick="history.back()">
          <i class="fas fa-arrow-left"></i> Back
        </button>
        <h2>Leaderboard (${mode === 'strikes' ? 'Strikes' : 'Points'})</h2>

        <div class="leaderboard-tabs">
          <button class="tab-button ${mode === 'points' ? 'active' : ''}" onclick="updateLeaderboardUI('points')">
            <i class="fas fa-star"></i> Points
          </button>
<button class="tab-button ${mode === 'strikes' ? 'active fire-tab' : ''}" onclick="updateLeaderboardUI('strikes')">
  <i class="fas fa-fire"></i> Strikes
</button>

        </div>

        <div class="top-3">
    `;

    for (let i = 0; i < top3.length; i++) {
      const player = top3[i];
      const avatar = await fetchAvatar(player.name);
      const rank = i + 1;
      const suffix = getRankSuffix(rank);
      const value = mode === 'strikes' ? player.strikes : player.coins;

      html += `
        <div class="top-player">
          <div class="leaderboard-avatar">${avatar}</div>
          <div class="rank-number">${rank}${suffix}</div>
          <p>${player.name}</p>
          <p style="opacity:0.8; font-size:0.9em;">
            ${value} ${iconHtml}
          </p>
        </div>
      `;
    }

    html += `</div><ul class="leaderboard-list">`;

    const colors = ['#ffa500', '#ff8c00', '#f39c12', '#e74c3c', '#c0392b'];
    for (let i = 0; i < others.length; i++) {
      const player = others[i];
      const avatar = await fetchAvatar(player.name);
      const rank = i + 4;
      const suffix = getRankSuffix(rank);
      const color = colors[i] || '#555';
      const value = mode === 'strikes' ? player.strikes : player.coins;

      html += `
        <li class="leaderboard-item">
          <div class="leaderboard-avatar">${avatar}</div>
          <span class="leaderboard-name">${player.name}</span>
          <span class="rank-badge" style="background:${color}">${rank}${suffix}</span>
          <span class="leaderboard-rank">
            ${value} ${iconHtml}
          </span>
        </li>
      `;
    }

    html += `</ul></div>`;
    leaderboardContainer.innerHTML = html;

  } catch (err) {
    console.error('Error loading leaderboard:', err);
    leaderboardContainer.innerHTML =
      '<p>Error loading leaderboard. Please try again later.</p>';
  }
}




// Helper function (assuming it exists)
function getRankSuffix(rank) {
    const special = rank % 100;
    if (special >= 11 && special <= 13) return 'th';

    switch (rank % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}


// Helper function (assuming it exists)
const avatarCache = new Map(); // name -> { html, timestamp }

const CACHE_TTL = 30 * 60 * 1000; // 10 минут

async function fetchAvatar(name) {
    const safeName = name.trim();
    const fallback = `<div class="avatar-placeholder">${safeName.charAt(0).toUpperCase()}</div>`;
    const now = Date.now();

    const cached = avatarCache.get(safeName);
    if (cached && now - cached.timestamp < CACHE_TTL) {
        return cached.html;
    }

    try {
        const response = await fetch(`/get_avatar/${encodeURIComponent(safeName)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const html = data.avatar_url
            ? `<img src="${data.avatar_url}" alt="${safeName}" class="avatar">`
            : fallback;

        avatarCache.set(safeName, { html, timestamp: now });
        return html;

    } catch (error) {
        console.warn(`Avatar not found for "${safeName}":`, error);
        avatarCache.set(safeName, { html: fallback, timestamp: now });
        return fallback;
    }
}




// Привязываем кнопку “Back” при инициализации приложения
const backBtnLeaderboaord = document.getElementById('leaderboard-back');
if (backBtnLeaderboaord) {
  backBtnLeaderboaord.addEventListener('click', () => {
    showPage('main');      // или другая страница, куда нужно вернуться
  });
}

async function openShop(username) {
  if (!username) return;

  let currentFilter = 'ALL';

  function updateCoinsValue() {
    fetch(`/api/get_user_coins/${username}`)
      .then(res => res.json())
      .then(data => {
        const el = document.getElementById('coins-value');
        el.textContent = (data && typeof data.coins === 'number') ? data.coins : '--';
      })
      .catch(() => {
        document.getElementById('coins-value').textContent = '--';
      });
  }

  async function generateFilterButtons() {
    const res = await fetch('/api/items');
    const items = await res.json();

    const types = Array.from(new Set(items.map(i => i.type)));
    types.unshift('ALL');

    const container = document.querySelector('.notif-toggle');
    container.innerHTML = ''; // Очистить фильтры

    types.forEach(type => {
      const btn = document.createElement('button');
      btn.textContent = type;
      btn.setAttribute('data-type', type);
      if (type === currentFilter) btn.classList.add('active');

      btn.addEventListener('click', () => {
        currentFilter = type;
        container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        generateProducts();
      });

      container.appendChild(btn);
    });
  }

async function generateProducts() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  // Показываем 6 skeleton карточек
  for (let i = 0; i < 6; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'product-card skeleton';
    skeleton.innerHTML = `
      <div class="skeleton-img"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line" style="width: 50%;"></div>
      <div class="skeleton-btn"></div>
    `;
    grid.appendChild(skeleton);
  }

  try {
    const res = await fetch('/api/items');
    const items = await res.json();
    grid.innerHTML = '';

    const filteredItems = currentFilter === 'ALL' ? items : items.filter(item => item.type === currentFilter);

    filteredItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'product-card';

      const isOutOfStock = item.items_left === 0;
      if (isOutOfStock) card.classList.add('disabled');
	  
	    if (item.image.endsWith('.gif')) {
    card.classList.add('gif-exclusive');
  }

      card.innerHTML = `
        <div class="card-content">
          <img src="${item.image}" alt="${item.name}" class="${item.image.endsWith('.gif') ? 'gif-item' : ''}">
          <h3>${item.name}</h3>
          <p>${isOutOfStock ? 'Out of stock' : `Items left: ${item.items_left}`}</p>
          <button class="buy-btn" ${isOutOfStock ? 'disabled' : ''}>
            ${isOutOfStock ? 'Unavailable' : `Buy ${item.cost} coins`}
          </button>
        </div>
      `;

      if (!isOutOfStock) {
// === 1. Генерация модального окна при загрузке ===
const modalHTML = `
  <div id="checkAnswerModal" class="custom-modal" style="display: none;">
    <div class="custom-modal-content">
      <div class="icon-wrapper">
        <i class="fas fa-wallet custom-modal-icon"></i>
      </div>
      <p class="modal-main-text">Do you want to proceed?</p>
      <p class="modal-sub-text">
        Price: <span class="payment-amount">0</span> coins
      </p>
      <p class="modal-sub-text">
        Commission fee: <span class="payment-commission">0</span> coins
      </p>
      <p class="modal-sub-text total-line">
        Total: <span class="payment-total">0</span> coins
      </p>
      <div class="custom-modal-actions">
        <button id="cancelCheckAnswer" class="custom-modal-btn custom-cancel">Cancel</button>
        <button id="approveCheckAnswer" class="custom-modal-btn custom-approve">Approve</button>
      </div>
    </div>
  </div>
`;
document.body.insertAdjacentHTML('beforeend', modalHTML);

// === 2. Глобальная переменная для текущей покупки ===
let currentPurchaseData = null;

// === 3. Обработчик покупки с динамической модалкой ===
card.querySelector('.buy-btn').addEventListener('click', () => {
  const commissionRate = 0.10;
  const commission = Math.ceil(item.cost * commissionRate);
  const totalCost = item.cost + commission;

  // Сохраняем покупку
  currentPurchaseData = { item, commission, totalCost };

  // Обновляем контент в модалке
  document.querySelector('#checkAnswerModal .modal-main-text').textContent =
    `Do you really want to buy "${item.name}" for ${totalCost} coins?`;

  document.querySelector('#checkAnswerModal .payment-amount').textContent = item.cost;
  document.querySelector('#checkAnswerModal .payment-commission').textContent = commission;
  document.querySelector('#checkAnswerModal .payment-total').textContent = totalCost;

  // Показываем модалку
  document.getElementById('checkAnswerModal').style.display = 'block';
});

// === 4. Кнопка Cancel ===
document.addEventListener('click', (e) => {
  if (e.target.id === 'cancelCheckAnswer') {
    document.getElementById('checkAnswerModal').style.display = 'none';
    currentPurchaseData = null;
  }
});

// === 5. Кнопка Approve ===
document.addEventListener('click', async (e) => {
  if (e.target.id !== 'approveCheckAnswer' || !currentPurchaseData) return;

  const { item, totalCost } = currentPurchaseData;

  const resp = await fetch('/api/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, id: item.id, amount: totalCost })
  });

  const result = await resp.json();

  document.getElementById('checkAnswerModal').style.display = 'none';
  currentPurchaseData = null;

  if (result.success) {
    showToastNotification(`Purchased ${item.name} for ${totalCost} coins`, 'success');
	showModalStatus(`Purchased "${item.name}" for ${totalCost} coins`);
    updateCoinsValue();
    generateProducts();
  } else {
    showToastNotification(result.message || 'Purchase failed', 'error');
	showModalStatus(result.message, "failed");
  }
});


      }

      grid.appendChild(card);
    });
  } catch (e) {
    console.error('Error generating products:', e);
    showToastNotification('Error loading products. Please try again.', 'warning');
    grid.innerHTML = ''; // Очистить скелетоны при ошибке
  }
}


  // Запуск при открытии магазина
  updateCoinsValue();
  await generateFilterButtons();
  await generateProducts();
}


async function initializeInventory(username) {
  if (!username) return;

  async function fetchInventory(username) {
    const response = await fetch(`/api/inventory/${username}`);
    return response.json();
  }

  async function fetchItemStatus(itemId) {
    const response = await fetch(`/api/item-status/${itemId}?username=${username}`);
    return response.json();
  }

function createItemElement(item) {
  const div = document.createElement('div');
  div.className = 'item';
  div.dataset.id = item.id;
  div.innerHTML = `
    <span class="name">${item.name}</span> - 
    <span class="cost">${item.cost} Coins</span>
    <span class="timestamp">${item.time ? new Date(item.time).toLocaleString() : ''}</span>
    <div class="progress-bar">
      <div class="stage"><div class="stage-icon"><i class="fas fa-box"></i></div><span>Product in packaging</span></div>
      <div class="stage"><div class="stage-icon"><i class="fas fa-truck"></i></div><span>Shipped</span></div>
      <div class="stage"><div class="stage-icon"><i class="fas fa-shipping-fast"></i></div><span>In transit</span></div>
      <div class="stage"><div class="stage-icon"><i class="fas fa-home"></i></div><span>Delivered</span></div>
    </div>
    <div class="item-actions"></div>
  `;
  return div;
}


function updateItemStatus(itemElement, statusObj, item) {
  const currentStatus = statusObj.status;
  const progressBar = itemElement.querySelector('.progress-bar');
  const stages = progressBar.querySelectorAll('.stage');

  const statusOrder = ['Product in packaging', 'Shipped', 'In transit', 'Delivered'];

  stages.forEach((stage) => {
    const stageName = stage.querySelector('span')?.textContent?.trim();
    const icon = stage.querySelector('.stage-icon i');

    if (!stageName || !icon) return;

    // Определяем состояние этапа
    const isCurrent = stageName === currentStatus;
    const isCompleted = !isCurrent &&
      statusOrder.indexOf(stageName) < statusOrder.indexOf(currentStatus);

    // Обновляем классы
    stage.classList.toggle('active', isCurrent);
    stage.classList.toggle('completed', isCompleted);

    // Обновляем иконку
    icon.className = isCompleted
      ? 'fas fa-check'
      : isCurrent
        ? getIconClass(stageName)
        : 'fas fa-circle';

    // Добавляем подсказку
    stage.title = isCompleted
      ? 'Completed'
      : isCurrent
        ? 'Current stage'
        : 'Waiting...';
  });

  // Очистка и установка кнопки "View"
  const actionsDiv = itemElement.querySelector('.item-actions');
  actionsDiv.innerHTML = '';

  const type = (item.type || '').toLowerCase();
  const canView = ['photo', 'video','zapal'].includes(type) && currentStatus === 'Delivered' && statusObj.link;

  if (canView) {
    const viewBtn = document.createElement('button');
    viewBtn.innerHTML = `<i class="fas fa-eye"></i> View`;
    viewBtn.className = 'view-btn';
    viewBtn.onclick = () => {
      window.open(statusObj.link, '_blank');
    };
    actionsDiv.appendChild(viewBtn);
  }
}





  function getIconClass(stageName) {
    switch (stageName) {
      case 'Product in packaging': return 'fas fa-box';
      case 'Shipped': return 'fas fa-truck';
      case 'In transit': return 'fas fa-shipping-fast';
      case 'Delivered': return 'fas fa-check-circle';
      default: return 'fas fa-box';
    }
  }

  async function loadInventory() {
    const itemsSection = document.getElementById('items-section');
    if (!itemsSection) {
      console.error('Element #items-section not found.');
      return;
    }

    const inventory = await fetchInventory(username);
    itemsSection.innerHTML = '';

    for (const item of inventory) {
      const itemElement = createItemElement(item);
      itemsSection.appendChild(itemElement);
      try {
        const status = await fetchItemStatus(item.id);
        updateItemStatus(itemElement, status, item);
      } catch (e) {
        updateItemStatus(itemElement, { status: 'Error' }, item);
        console.error(`Failed to load status for item ${item.id}`, e);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadInventory);
  } else {
    loadInventory();
  }
}


function showToastNotification(message, type = 'success', duration = 5000) {
    const icons = {
      success: 'fa-check',
      error:   'fa-exclamation-triangle',
      warning: 'fa-exclamation-circle',
      info:    'fa-info-circle'
    };

    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.setProperty('--hide-delay', `${(duration/1000).toFixed(2)}s`);
	
	if (type === 'error') {
    const audio = new Audio('static/music/error.wav');
    audio.play().catch(err => {
    console.warn('Failed to play error sound:', err);
    });
    }

    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i>`;

    const msg = document.createElement('div');
    msg.className = 'toast-message';
    msg.innerHTML = message;

    const closeBtn = document.createElement('div');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => toast.remove();

    toast.append(icon, msg, closeBtn);
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('active'));

    setTimeout(() => toast.remove(), duration + 400);
  }


function updateDays() {
  const daysContainer = document.getElementById('days');
  daysContainer.innerHTML = '';

  const allUnits = generateAllUnits(); // ['1.1', ..., '12.3']
  console.log('[Units] 🔢 Все юниты:', allUnits);

  const currentIndex = allUnits.indexOf(currentUnit);
  if (currentIndex === -1) {
    console.warn('[Units] ❌ currentUnit не найден:', currentUnit);
    return;
  }

  // Получаем текущую главу (например, '1' из '1.2')
  const currentChapter = currentUnit.split('.')[0];

  // Фильтруем юниты только из текущей главы
  const visibleUnits = allUnits.filter(unit => unit.startsWith(`${currentChapter}.`));
  const availableUnits = getAvailableUnits();

  console.log('[Units] 👁️ Видимые юниты:', visibleUnits);
  console.log('[Units] ✅ Доступные юниты:', availableUnits);
  console.log('[Units] 📌 Текущий юнит:', currentUnit);

  visibleUnits.forEach(unit => {
    const span = document.createElement('span');
    const isActive = unit === currentUnit;
    const isUnlocked = availableUnits.includes(unit);

    span.className = 'day' + (isActive ? ' active' : '') + (isUnlocked ? '' : ' locked');
    span.textContent = `Unit ${unit}`;

    console.log(`[Units] ➕ Unit: ${unit}, active: ${isActive}, unlocked: ${isUnlocked}`);

    if (isUnlocked) {
      span.addEventListener('click', () => {
        console.log(`[Units] 🖱️ Клик по юниту: ${unit}`);
        currentUnit = unit;
        localStorage.setItem('currentUnit', unit);
        updateDays();           // пересоздаём список юнитов с новой главой
        renderTasksSection();   // перерисовываем задания
      });
    }

    daysContainer.appendChild(span);
  });

  // Показываем календарь при обновлении
  daysContainer.classList.add('visible');
}

function toggleCalendar() {
  const picker = document.getElementById('unit-picker');
  picker.classList.toggle('visible');

  if (picker.classList.contains('visible')) {
    renderUnitPicker();
    hideNavigation(); // 👈 скрываем nav
  } else {
    showNavigation(); // 👈 показываем nav
  }
}


function renderUnitPicker() {
  const picker = document.getElementById('unit-picker');
  picker.innerHTML = '<h3>Select a Unit</h3>';

  const grid = document.createElement('div');
  grid.className = 'unit-grid';

  const allUnits = generateAllUnits();
  const availableUnits = getAvailableUnits();

  const currentIndex = allUnits.indexOf(currentUnit);
  const currentChapter = currentUnit.split('.')[0];
  const chapters = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  chapters.forEach(chapter => {
    const box = document.createElement('div');
    box.className = 'unit-box';
    box.textContent = `Unit ${chapter}`;

    const chapterUnits = allUnits.filter(u => u.startsWith(chapter + '.'));
    const isUnlocked = availableUnits.some(u => u.startsWith(chapter + '.'));

    const chapterStartIndex = allUnits.indexOf(chapterUnits[0]);
    const chapterEndIndex = allUnits.indexOf(chapterUnits[chapterUnits.length - 1]);

    if (currentIndex >= chapterStartIndex && currentIndex <= chapterEndIndex) {
      box.classList.add('active'); // текущий unit находится в этой главе
    } else if (isUnlocked && currentIndex > chapterEndIndex) {
      box.classList.add('completed'); // завершённая глава
    } else if (!isUnlocked) {
      box.classList.add('locked'); // заблокировано
    }

    // Нажатие по юниту
box.addEventListener('click', () => {
  currentUnit = chapter + '.1';
  localStorage.setItem('currentUnit', currentUnit);
  updateDays();
  renderTasksSection();
  renderUnitPicker();

  // 👇 Закрытие всплывающего меню
  document.getElementById('unit-picker').classList.remove('visible');
  showNavigation();
});


    grid.appendChild(box);
  });

  picker.appendChild(grid);
}



function generateAllUnits() {
  const units = [];
  for (let i = 1; i <= 12; i++) {
    for (let j = 1; j <= 3; j++) {
      units.push(`${i}.${j}`);
    }
  }
  return units;
}

function getAvailableUnits() {
  const all = generateAllUnits();
  // Retrieve the highest completed unit from localStorage or default to currentUnit
  let highestUnit = localStorage.getItem('highestUnit') || activeCurrentUnit;
  const highestIndex = all.indexOf(highestUnit);
  const currentIndex = all.indexOf(currentUnit);

  // Ensure highestUnit is updated if currentUnit is beyond it
  if (currentIndex > highestIndex) {
    highestUnit = activeCurrentUnit;
    localStorage.setItem('highestUnit', activeCurrentUnit);
  }

  const available = all.slice(0, all.indexOf(highestUnit) + 1);
  console.log('[Units] 📗 Доступные до highestUnit:', available);
  return available;
}


function updateTaskCount() {
  const taskItems = document.querySelectorAll('.task-progress-card');
  const total = taskItems.length;
  const completed = [...taskItems].filter(el => el.classList.contains('disabled')).length;

  const taskCountElement = document.getElementById('task-count');
  if (!taskCountElement) return;

  taskCountElement.innerHTML = `
    Today's Tasks 
    <span class="task-badge">${completed} / ${total} completed</span>
  `;
}


function hideNavigation() {
  const nav = document.querySelector('nav');
  if (nav) {
    nav.classList.add('nav-hidden');
  } else {
    console.warn('Navigation element not found');
  }
}

function showNavigation() {
  const nav = document.querySelector('nav');
  if (nav) {
    nav.classList.remove('nav-hidden');
  } else {
    console.warn('Navigation element not found');
  }
}

function toggleNavigation() {
  const nav = document.querySelector('nav');
  nav.classList.toggle('nav-hidden');
}

let examEnded = false;
let zeroReachedTime = null;
let remainingTime = null;
let localTimerInterval = null;
let examResults = {};
let examTaskTitle = 'Exam'; // Название, заменяется динамически при рендере

function fetchInitialExamTime() {
  fetch('/get_remaining_time')
    .then(res => res.json())
    .then(data => {
      if (data.remaining_time !== undefined) {
        remainingTime = data.remaining_time;
        updateExamDisplay();
        startLocalCountdown();
      } else {
        remainingTime = null;
        updateExamDisplay();
      }
      fetchExamResults();
    })
    .catch(err => {
      console.error('Failed to fetch exam time:', err);
      remainingTime = null;
      updateExamDisplay();
      fetchExamResults();
    });
}

function startLocalCountdown() {
  if (localTimerInterval) clearInterval(localTimerInterval);
  localTimerInterval = setInterval(() => {
    if (remainingTime > 0) {
      remainingTime--;
      updateExamDisplay();
    } else if (remainingTime === 0 && !examEnded) {
      if (!zeroReachedTime) {
        zeroReachedTime = Date.now();
      } else if (Date.now() - zeroReachedTime >= 10000) {
        fetch('/api/end-exam', { method: 'POST' })
          .then(res => res.json())
          .then(res => {
            console.log('Exam ended:', res.message);
            examEnded = true;
            clearInterval(localTimerInterval);
          })
          .catch(err => console.error('Failed to end exam:', err));
      }
    }
  }, 1000);
}

function updateExamDisplay() {
  const examItem = document.getElementById('final-exam-item');
  if (!examItem) return;

  const currentUser = sessionStorage.getItem('username');
  const userData = examResults && examResults[currentUser];

  let minutes = 0, seconds = 0, inProgress = false;

  if (typeof remainingTime === 'number' && remainingTime >= 0) {
    inProgress = true;
    minutes = Math.floor(remainingTime / 60);
    seconds = remainingTime % 60 | 0;
  }

  const percent = userData ? Math.round(userData.correct_percentage) : 0;
  const pctText = `${percent}%`;
  const countText = userData
    ? `${userData.correct} out of ${userData.total_questions}`
    : `0 out of 0`;

  let statusHTML = '';
  let barFill = `${percent}%`;
  let cursor = 'default';
  let clickHandler = null;

  if (percent > 0) {
    // ✅ Задания есть → считаем "Done", блокируем
    statusHTML = `
      <div class="exam-status" style="background: rgba(23,162,184,0.85);">
        <i class="fas fa-check-circle"></i> Done
        <span class="timer">--:--</span>
      </div>`;
    barFill = `${percent}%`;
  } else if (inProgress) {
    // 🟡 Идёт экзамен → доступен клик
    statusHTML = `
      <div class="exam-status">
        <i class="fas fa-hourglass-half"></i> In Progress
        <span class="timer">${minutes}:${seconds < 10 ? '0'+seconds : seconds}</span>
      </div>`;
    cursor = 'pointer';
    clickHandler = () => {
      localStorage.setItem('openExamTask', 'true');
      window.location.href = '/chat';
    };
  } else if (typeof remainingTime !== 'number') {
    // ⏳ Not started
    statusHTML = `
      <div class="exam-status" style="background: rgba(108,117,125,0.85);">
        <i class="fas fa-clock"></i> Not started
        <span class="timer">--:--</span>
      </div>`;
  } else {
    // ❌ Завершено
    statusHTML = `
      <div class="exam-status" style="background: rgba(220,53,69,0.85);">
        <i class="fas fa-ban"></i> Unavailable
        <span class="timer">--:--</span>
      </div>`;
  }

  examItem.innerHTML = `
    <div class="exam-icon">
      <img src="/static/icons/exam.png" alt="Exam Icon" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); width:40px; height:40px;">
    </div>
    <div class="exam-title">${examTaskTitle}${(percent > 0 && !inProgress) ? ' (Completed)' : ''}</div>
    ${statusHTML}
    <div class="final-exam-progress-bar">
      <div class="final-exam-progress-bar__fill" style="width: ${barFill}"></div>
    </div>
    <div class="final-exam-texts">
      <span class="final-exam-progress-text">${pctText}</span>
    </div>
    <span class="final-exam-count-text">${countText}</span>
  `;

  const fillEl = examItem.querySelector('.final-exam-progress-bar__fill');
  if (fillEl) {
    fillEl.classList.remove('low', 'medium', 'high');
    if (percent < 50) fillEl.classList.add('low');
    else if (percent < 80) fillEl.classList.add('medium');
    else fillEl.classList.add('high');
  }

  // Применить поведение клика и курсора
  examItem.style.cursor = cursor;
  examItem.onclick = clickHandler;

  updateTaskCount();
}




async function renderTasksSection() {
  const container = document.getElementById('today');
  container.querySelectorAll('.tasks-section, .no-tasks-placeholder').forEach(el => el.remove());

  if (!currentUnit || typeof currentUnit !== 'string') {
    console.warn('[Tasks] ⚠️ currentUnit некорректен:', currentUnit);
    renderNoTasksPlaceholder(container);
    return;
  }
  if (!currentLevel) {
    console.warn('[Tasks] ⚠️ currentLevel не задан');
    renderNoTasksPlaceholder(container);
    return;
  }

  const section = document.createElement('div');
  section.className = 'tasks-section loading';
  section.style.display = 'flex';
  section.style.flexDirection = 'column';
  section.style.alignItems = 'center';
  section.style.minHeight = '150px';

  const loader = document.createElement('div');
  loader.className = 'container-exam-loading';
  loader.innerHTML = `
<div class="container-exam-loading">
  <div class="loader"></div>
</div>

  `;
  section.appendChild(loader);
  container.appendChild(section);

  try {
    const [tasksRes, resultsRes, avgRes] = await Promise.all([
      fetch(`/api/get-today-questions?level=${encodeURIComponent(currentLevel)}&unit=${encodeURIComponent(currentUnit)}`),
      fetch(`/api/get-results?level=${encodeURIComponent(currentLevel)}&unit=${encodeURIComponent(currentUnit)}`),
      fetch(`/api/get-results/average?level=${encodeURIComponent(currentLevel)}&unit=${encodeURIComponent(currentUnit)}&username=${encodeURIComponent(currentUser)}`)
    ]);
    if (!tasksRes.ok || !resultsRes.ok || !avgRes.ok) throw new Error('Ошибка запроса');

    const { today_tasks } = await tasksRes.json();
    const resultsData = await resultsRes.json();
    const userResult = resultsData[currentUser] || {};
    const avgData = await avgRes.json();
    const userAvg = avgData[currentUser] || { average_percent: 0, submitted_count: 0, total_tasks: today_tasks.length };

    const writingAIBlock = today_tasks.find(task => task.title === 'Writing AI');
    if (writingAIBlock) {
      const writingTask = {
        title: "Writing AI",
        type: "writing",
        questions: [{
          type: "writing",
          text: writingAIBlock.questions && writingAIBlock.questions.topic
            ? `Write an essay the topic: “${writingAIBlock.questions.topic}”. Aim for 70+ words.`
            : "Write an essay the advantages and disadvantages of public transport. Aim for 70+ words.",
          id: "Writing Topic ID 1"
        }]
      };

      const existingWritingTaskIndex = today_tasks.findIndex(task => 
        task.title === 'Writing AI' || task.type === 'writing' || task.title.toLowerCase().includes('writing')
      );
      if (existingWritingTaskIndex !== -1) {
        today_tasks[existingWritingTaskIndex] = writingTask;
      }
    }

    section.classList.remove('loading');
    section.innerHTML = '';

    const avgContainer = document.createElement('div');
    avgContainer.className = 'average-progress-container';
    if (typeof activeCurrentUnit !== 'undefined' && currentUnit !== activeCurrentUnit) {
      avgContainer.classList.add('disabled');
    }
    const avgPercent = Math.min(Math.round(userAvg.average_percent), 100);
    const submittedCount = userAvg.submitted_count || 0;
    const totalTasks = userAvg.total_tasks || 0;

    const title = document.createElement('span');
    title.className = 'average-progress-title';
    title.textContent = "Today's Tasks";

    const taskCount = document.createElement('span');
    taskCount.className = 'average-progress-count';
    taskCount.textContent = `${submittedCount}/${totalTasks} tasks`;

    const progressBar = document.createElement('div');
    progressBar.className = 'average-progress-bar';
    progressBar.style.setProperty('--progress-width', `${avgPercent}%`);

    const strikeIcon = document.createElement('i');
    strikeIcon.className = 'fas fa-fire strike-icon';
    if (avgPercent >= 80) {
      strikeIcon.classList.add('strike-active');
    }
    progressBar.appendChild(strikeIcon);

    const progressText = document.createElement('span');
    progressText.className = 'average-progress-percent';
    progressText.textContent = `${avgPercent}%`;

    avgContainer.append(title, taskCount, progressBar, progressText);
    section.appendChild(avgContainer);

    section.innerHTML += `<h2 id="task-count" style="display:none;">Today's Tasks</h2>`;

    const typePriority = ['homework', 'grammar', 'vocabulary', 'listening', 'reading', 'writing'];

    const filteredTasks = today_tasks;

    if (!filteredTasks.length) {
      renderNoTasksPlaceholder(container);
      return;
    }

    filteredTasks.sort((a, b) => {
      const aKey = a.title.toLowerCase();
      const bKey = b.title.toLowerCase();
      const aIndex = typePriority.findIndex(type => aKey.includes(type));
      const bIndex = typePriority.findIndex(type => bKey.includes(type));
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });

    filteredTasks.forEach(block => {
      const title = block.title;
      const result = userResult[title];
      const isCompleted = result?.submitted === true;
      const percent = Math.round(result?.percent || 0);
      const hasReward = isCompleted && percent >= 80;

      const card = document.createElement('div');
      card.className = 'task-progress-card';

      const isWriting = block.type === 'writing';

      if (isCompleted && !isWriting) {
        card.classList.add('disabled');
      }

// Хелпер: определяет, относится ли блок к экзамену по названию/пути/имени файла
function isExamBasedBlock(blk) {
  const examRe = /(^|[\\/])exam\b/i; // начало строки или после / или \, слово "Exam" (без учета регистра)
  return (
    examRe.test(blk?.filename || '') ||
    examRe.test(blk?.file || '') ||
    examRe.test(blk?.path || '') ||
    examRe.test(blk?.title || '')
  );
}

// ...
if (!isCompleted || isWriting) {
  card.classList.add('clickable');
  card.onclick = () => {
    console.log('Attempting to open task:', title);
    console.log('Task result:', result);
    console.log('Block data:', block);

    if (!block.questions || block.questions.length === 0) {
      console.warn('No questions found for:', title);
      showToastNotification(`Cannot open ${title} - no questions found.`);
      return;
    }

    // --- Определение типа открытия (исправлено) ---
    const openType = isExamBasedBlock(block) ? "Exam based" : "Default";
    console.log("Open type:", openType);

    if (isWriting) {
      console.log('Opening writing task...');
      openWritingTaskPage(title, block.questions, openType);
    } else {
      console.log('Opening non-writing task...');
      openTodayTaskPage(title, block.questions, openType);
    }
  };
}



      const key = title.toLowerCase();
      let iconClass = 'fa-star';
      let iconColor = 'linear-gradient(135deg, #3f87ff, #8058f5)';
      if (key.includes('homework')) {
        iconClass = 'fa-pencil-square';
        iconColor = 'linear-gradient(135deg, #ff9800, #f44336)';
      } else if (key.includes('grammar')) {
        iconClass = 'fa-book-open';
        iconColor = 'linear-gradient(135deg, #4caf50, #2e7d32)';
      } else if (key.includes('vocabulary')) {
        iconClass = 'fa-language';
        iconColor = 'linear-gradient(135deg, #2196f3, #1565c0)';
      } else if (key.includes('listening')) {
        iconClass = 'fa-headphones';
        iconColor = 'linear-gradient(135deg, #9c27b0, #6a1b9a)';
      } else if (key.includes('reading')) {
        iconClass = 'fa-book-reader';
        iconColor = 'linear-gradient(135deg, #00bcd4, #0097a7)';
      } else if (key.includes('writing')) {
        iconClass = 'fa-pen';
        iconColor = 'linear-gradient(135deg, #f06292, #d81b60)';
      } else if (key.includes('fun')) {
        iconClass = 'fa-play';
        iconColor = 'linear-gradient(135deg, #4caf50, #8bc34a)';
      }

      const icon = document.createElement('div');
      icon.className = 'task-progress-icon';
      icon.style.background = iconColor;
      icon.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;

      const textGroup = document.createElement('div');
      textGroup.className = 'task-progress-main';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'task-progress-title';
      titleDiv.textContent = title;

      let taskCount = null;
      if (result?.submitted) {
        taskCount = document.createElement('div');
        taskCount.className = 'task-progress-count';
        const totalTasks = result.total || (block.questions ? block.questions.length : 0);
        const correctTasks = result.correct || 0;
        taskCount.textContent = `${correctTasks} correct out of ${totalTasks} tasks`;
      }

      const progressContainer = document.createElement('div');
      progressContainer.className = 'task-progress-container';

      const progressBarWrapper = document.createElement('div');
      progressBarWrapper.className = 'task-progress-bar-wrapper';

      const progressBar = document.createElement('div');
      progressBar.className = 'task-progress-bar';
      progressBar.style.width = '0%';

      if (percent >= 80) {
        progressBar.style.background = 'linear-gradient(90deg, #6dee6d, #32cd32)';
      } else if (percent >= 60) {
        progressBar.style.background = 'linear-gradient(90deg, #ffd54f, #ffb300)';
      } else {
        progressBar.style.background = 'linear-gradient(90deg, #ef5350, #d32f2f)';
      }

      setTimeout(() => {
        progressBar.style.width = `${Math.min(percent, 100)}%`;
      }, 50);

      const progressText = document.createElement('span');
      progressText.className = 'task-progress-percent';
      progressText.textContent = `${percent}%`;

      progressBarWrapper.appendChild(progressBar);
      progressContainer.append(progressBarWrapper, progressText);
      textGroup.append(titleDiv);
      if (taskCount) textGroup.append(taskCount);
      textGroup.append(progressContainer);

      const award = document.createElement('div');
      award.className = 'task-progress-award';
      if (hasReward) {
        award.innerHTML = `<i class="fa-solid fa-star"></i> 100`;
        award.classList.add('pop-bounce');
      } else {
        award.style.display = 'none';
      }

      card.append(icon, textGroup, award);

      if (isWriting && result?.ai_detected) {
        const errorOverlay = document.createElement('div');
        errorOverlay.className = 'ai-error-overlay';
        const errorContent = document.createElement('div');
        errorContent.className = 'ai-error-overlay-content';
        errorContent.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> AI Detected';
        errorOverlay.appendChild(errorContent);
        card.appendChild(errorOverlay);
      }

      section.appendChild(card);
    });

    updateTaskCount();
  } catch (err) {
    section.classList.remove('loading');
    section.style.display = 'none';
    console.error('[Tasks] ❌ Ошибка загрузки заданий:', err);
    renderNoTasksPlaceholder(container);
  }
}

function finishWritingAI(title, questions) {
  initExamSecurity(false);
  updateStrikes();
  showNavigation();
  const answers = {};
  const errors = [];
  const content = document.getElementById('todaytasks-content');

  content.querySelectorAll('textarea.writing-task-textarea').forEach(textarea => {
    const qid = textarea.dataset.qid;
    const val = textarea.value.trim();
    if (val) {
      const wordCount = val.split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount < 30 || wordCount > 200) {
        errors.push(`Your essay should be between 30 and 200 words (current: ${wordCount} words).`);
      } else {
        answers[qid] = val;
      }
    } else {
      errors.push(`Please provide an essay for the writing task (question ${qid}).`);
    }
  });

  if (errors.length) {
    showToastNotification(errors[0], 'warning');
    return;
  }

  const payload = {
    level: currentLevel,
    unit: currentUnit,
    username: currentUser,
    title,
    answers,
    questions
  };

  document.getElementById('updateModal').style.display = 'flex';
  startUpdateStatusText();

  fetch('/api/submit-writing-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      document.getElementById('updateModal').style.display = 'none';
      stopUpdateStatusText();

      if (!ok) throw new Error(data.error || 'Submission failed');

      const { feedback, scores, score } = data;
      const suggestions = feedback.suggestion || {};
      const resultHTML = [];


      questions.forEach(q => {

        if (feedback && scores) {
          resultHTML.push(`<div class="writing-feedback-card">`);
          resultHTML.push(`<div class="score-circle">${score}%</div>`);
          resultHTML.push(`<div class="accordion-writingai">`);

          const feedbackMap = [
            { label: "Task Achievement & Structure", key: "task_structure", iconClass: "fas fa-tasks" },
            { label: "Organization", key: "organization", iconClass: "fas fa-layer-group" },
            { label: "Grammar", key: "grammar", iconClass: "fas fa-pen-nib" },
            { label: "Vocabulary", key: "vocabulary", iconClass: "fas fa-book" }
          ];

          feedbackMap.forEach(({ label, key, iconClass }) => {
            resultHTML.push(`
              <div class="accordion-item">
                <button class="accordion-header" onclick="this.classList.toggle('active'); this.nextElementSibling.classList.toggle('open');">
                  <span class="feedback-icon"><i class="${iconClass}"></i></span>
                  <span class="label">${label}</span>
                  <span class="score">${scores[key]}/25</span>
                </button>
                <div class="accordion-body">
                  <p>${feedback[key].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>
                  ${suggestions[key] ? `<div class="suggestion-block"><strong><i class="fas fa-lightbulb"></i> Suggestion</strong>${suggestions[key]}</div>` : ''}
                </div>
              </div>
            `);
          });

          resultHTML.push(`</div></div>`);
        } else {
          resultHTML.push(`<p class="feedback-warning">No feedback available.</p>`);
        }
      });

      content.innerHTML = resultHTML.join('');

      if (score >= 80) {
        new Audio('/static/music/Coins_Rewarded.mp3').play().catch(console.log);
      }

      document.querySelectorAll('.rain-drop, .lightning-flash, .lightning-icon').forEach(el => el.remove());

      const header = document.getElementById('todaytasks-header');
      header.classList.add('summer-scene');

      const moon = document.createElement('div');
      moon.className = 'moon';
      header.appendChild(moon);

      const tree = document.createElement('div');
      tree.className = 'summer-tree';
      header.appendChild(tree);

      for (let i = 0; i < 30; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.top = `${Math.random() * 60}%`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 4}s`;
        header.appendChild(star);
      }

      for (let i = 0; i < 8; i++) {
        const firefly = document.createElement('div');
        firefly.className = 'firefly';
        firefly.style.top = `${60 + Math.random() * 40}%`;
        firefly.style.left = `${Math.random() * 100}%`;
        firefly.style.animationDelay = `${Math.random() * 5}s`;
        header.appendChild(firefly);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });

      document.getElementById('finish-tasks-btn').style.display = 'none';
      let doneBtn = document.getElementById('done-tasks-btn');

      if (!doneBtn) {
        doneBtn = document.createElement('button');
        doneBtn.id = 'done-tasks-btn';
        doneBtn.className = 'btn btn-success';
        doneBtn.textContent = 'Done';
        doneBtn.onclick = () => {
          showPage('today');
          content.innerHTML = '';
          doneBtn.style.display = 'none';
          document.getElementById('finish-tasks-btn').style.display = 'inline-block';
          renderTasksSection();
        };
        document.getElementById('todaytasks-header').appendChild(doneBtn);
      } else {
        doneBtn.style.display = 'inline-block';
      }

      document.getElementById('done-tasks-btn').onclick = () => {
        showPage('today');
        content.innerHTML = '';
        document.getElementById('done-tasks-btn').style.display = 'none';
        document.getElementById('finish-tasks-btn').style.display = 'inline-block';
        const floating = document.getElementById('floating-finish-btn');
        if (floating) floating.style.display = 'none';
        renderTasksSection();
      };

      fetch(`/api/update-results?level=${encodeURIComponent(currentLevel)}&unit=${encodeURIComponent(currentUnit)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          taskTitle: title,
          percent: score,
          submitted: true
        })
      }).then(() => renderTasksSection());
    })
    .catch(err => {
      console.error('[Writing] ❌ Error submitting writing task:', err);
      document.getElementById('updateModal').style.display = 'none';
      stopUpdateStatusText();
      showToastNotification(err.message, 'error');
    });
}





async function openWritingTaskPage(title, questions) {
  initExamSecurity(true);
  hideNavigation();
  showPage('todaytasks');

  const header = document.getElementById('header-today');
  const unit = document.getElementById('todaytasks-unit');
  header.textContent = title;
  unit.textContent = `Unit ${currentUnit}`;

  document.querySelectorAll('.moon, .summer-tree, .star, .firefly').forEach(el => el.remove());
  document.getElementById('todaytasks-header').classList.remove('summer-scene');

  const rainAndLightningHTML = `
    <div class="lightning-flash"></div>
    ${[10, 20, 30, 40, 50, 60, 70].map((left, i) =>
      `<span class="rain-drop" style="left: ${left}%; animation-delay: ${i * 0.2}s;"></span>`
    ).join('')}
    ${Array.from({ length: 3 }).map(() =>
      `<div class="lightning-drop" style="left: ${Math.random() * 90 + 5}%; animation-delay: ${Math.random() * 3}s;"></div>`
    ).join('')}
  `;
  header.insertAdjacentHTML('beforeend', rainAndLightningHTML);

  const content = document.getElementById('todaytasks-content');
  content.innerHTML = '';

  let resultData = null;
  try {
    const res = await fetch(`/api/get-results?level=${encodeURIComponent(currentLevel)}&unit=${encodeURIComponent(currentUnit)}`);
    const json = await res.json();
    resultData = json?.[currentUser]?.['Writing AI'];
  } catch (err) {
    console.error('Error loading results:', err);
  }

  const submitted = resultData?.submitted;

  questions.forEach((q, qi) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'exam-question-block';

    const heading = document.createElement('h3');
    heading.className = 'question-title';
    heading.innerHTML = `${qi + 1}. ${q.text}`;
    wrapper.appendChild(heading);

    if (submitted) {
      initExamSecurity(false);
      const result = resultData.details?.find(d => d.question_id === `Writing Topic ID ${qi + 1}`);
      if (result) {
        const feedback = result.feedback || {};
        const suggestion = feedback.suggestion || {};
        const scores = result.scores_breakdown || {};

        const scoreBlock = `
          <div class="writing-score-block">Score: ${result.score}/100</div>
        `;

        const feedbackBlock = Object.entries(feedback)
          .filter(([k]) => k !== 'suggestion')
          .map(([category, text]) => `
            <div class="writing-feedback-card">
              <h4>${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
              <p>${text}</p>
              ${suggestion[category] ? `<div class="suggestion-block"><strong>Suggestion:</strong> ${suggestion[category]}</div>` : ''}
            </div>
          `).join('');

        wrapper.insertAdjacentHTML('beforeend', scoreBlock + feedbackBlock);
      } else {
        wrapper.innerHTML += `<div class="writing-feedback-card"><p>No result available.</p></div>`;
      }
    } else {
      const textareaWrapper = document.createElement('div');
      textareaWrapper.style.position = 'relative';

      const textarea = document.createElement('textarea');
      textarea.className = 'writing-task-textarea';
      textarea.placeholder = 'Write your essay here (30+ words)...';
      textarea.name = `q${q.id}`;
      textarea.dataset.qid = q.id;

      const wordCounter = document.createElement('div');
      wordCounter.className = 'word-count';
      wordCounter.textContent = '0 words';
      wordCounter.style.position = 'absolute';
      wordCounter.style.bottom = '15px';
      wordCounter.style.right = '10px';
      wordCounter.style.fontSize = '12px';
      wordCounter.style.color = '#666';

      textarea.addEventListener('input', () => {
        const wordCount = textarea.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        wordCounter.textContent = `${wordCount} word${wordCount === 1 ? '' : 's'}`;
      });

      textarea.addEventListener('blur', () => {
        const wordCount = textarea.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount < 30) {
          showToastNotification(`Your writing must be at least 30 words. Currently: ${wordCount}`, 'warning');
        }
      });

      textareaWrapper.appendChild(textarea);
      textareaWrapper.appendChild(wordCounter);
      wrapper.appendChild(textareaWrapper);
    }

    content.appendChild(wrapper);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  let floatingBtn = document.getElementById('floating-finish-btn');
  if (!floatingBtn && !submitted) {
    floatingBtn = document.createElement('button');
    floatingBtn.id = 'floating-finish-btn';
    floatingBtn.innerHTML = '<i class="fas fa-check"></i> Finish Task';
    document.body.appendChild(floatingBtn);
  }
  if (floatingBtn) {
    floatingBtn.style.display = submitted ? 'none' : 'block';
    floatingBtn.onclick = () => {
      floatingBtn.style.display = 'none';
      finishWritingAI(title, questions);
    };
  }

  document.getElementById('done-tasks-btn').style.display = 'none';
  const finishBtn = document.getElementById('finish-tasks-btn');
  finishBtn.style.display = submitted ? 'none' : 'inline-block';
  finishBtn.onclick = () => {
    floatingBtn.style.display = 'none';
  };
}











// ----------------------------
// 2. Открытие страницы с вопросами и рендер
// ----------------------------

// ----------------------------
// openTodayTaskPage — фикс: goToIndex объявлен до регистрации обработчиков
// ----------------------------
window.examTimerInterval = window.examTimerInterval || null;

async function openTodayTaskPage(title, questions, openType = "Default") {
  const pageRoot = document.getElementById('todaytasks');
  const headerContainer = document.getElementById('todaytasks-header');
  const headerH1 = document.getElementById('header-today');
  const unitEl = document.getElementById('todaytasks-unit');
  const content = document.getElementById('todaytasks-content');

  // Глобальное место для итоговых ответов — очищаем при новом открытии набора
  window._todaytasks_answers = window._todaytasks_answers || {};
  window._todaytasks_answers = {};

  // answersMap хранит ответы в пределах одного вызова openTodayTaskPage
  const answersMap = {}; // ключ: qid (например "12"), значение: { type: 'text'|'radio'|'select'|'box'|'unscramble', value: ... }

  // Очистка старого таймера
  if (window.examTimerInterval) {
    clearInterval(window.examTimerInterval);
    window.examTimerInterval = null;
  }
  const prevTimer = document.getElementById('exam-timer');
  if (prevTimer) prevTimer.remove();

  if (unitEl) unitEl.style.display = '';

  // Exam-based проверка (как было)
  if (openType === "Exam based") {
    maxViolations = 1;
    initExamSecurity(true);
    try {
      const timesRes = await fetch('/api/get_exam_times');
      if (!timesRes.ok) throw new Error('Failed to fetch exam times');
      const timesData = await timesRes.json();
      const { current_time, exam_start_time } = timesData;
      if (!exam_start_time || current_time < exam_start_time) {
        showPage('today');
        showToastNotification("Exam has not started yet.");
        return;
      }
    } catch (err) {
      console.error('[Exam] Error fetching exam times', err);
      showPage('today');
      showToastNotification("Error checking exam status.");
      return;
    }
  }

  // Анимация входа на страницу
  hideNavigation();
  showPage('todaytasks');
  if (pageRoot) {
    pageRoot.classList.remove('todaytasks-enter');
    void pageRoot.offsetWidth;
    pageRoot.classList.add('todaytasks-enter');
    pageRoot.addEventListener('animationend', function _once() {
      pageRoot.classList.remove('todaytasks-enter');
      pageRoot.removeEventListener('animationend', _once);
    });
  }

  if (headerH1) headerH1.textContent = title;
  if (unitEl && typeof currentUnit !== 'undefined') unitEl.textContent = `Unit ${currentUnit}`;

  // Удаляем декоративные элементы
  document.querySelectorAll('.moon, .summer-tree, .star, .firefly').forEach(el => el.remove());
  if (headerContainer) headerContainer.classList.remove('summer-scene');

  // Дождь/молнии (как раньше)
  const rainAndLightningHTML = `
    <div class="lightning-flash"></div>
    ${[10,20,30,40,50,60,70].map((left,i) =>
      `<span class="rain-drop" style="left:${left}%; animation-delay:${i*0.2}s;"></span>`
    ).join('')}
    ${Array.from({length:3}).map(() =>
      `<div class="lightning-drop" style="left:${Math.random()*90 + 5}%; animation-delay:${Math.random()*3}s;"></div>`
    ).join('')}
  `;
  if (headerContainer) {
    const existingRain = headerContainer.querySelectorAll('.rain-drop, .lightning-drop, .lightning-flash');
    if (existingRain && existingRain.length) existingRain.forEach(n => n.remove());
    headerContainer.insertAdjacentHTML('beforeend', rainAndLightningHTML);
  }

  // Exam timer (компактный) — как было, но при финише сохраняем snapshot answers
  if (openType === "Exam based") {
    if (unitEl) unitEl.style.display = 'none';
    const existingCompact = document.getElementById('exam-timer');
    if (existingCompact) existingCompact.remove();

    const compactTimer = document.createElement('div');
    compactTimer.id = 'exam-timer';
    compactTimer.className = 'compact-exam-timer';
    compactTimer.innerHTML = `<i class="fa-solid fa-stopwatch"></i> <span id="exam-time-text">--:--</span>`;
    if (unitEl && unitEl.parentElement) {
      unitEl.parentElement.insertBefore(compactTimer, unitEl.nextSibling);
    } else if (headerH1 && headerH1.parentElement) {
      headerH1.parentElement.appendChild(compactTimer);
    } else if (headerContainer) {
      headerContainer.appendChild(compactTimer);
    }
    const timeSpan = compactTimer.querySelector('#exam-time-text');

    let remainingSeconds = 0;
    try {
      const res = await fetch('/get_remaining_time');
      if (!res.ok) throw new Error('Failed to get remaining time');
      const data = await res.json();
      if (data.error) {
        showToastNotification(data.error);
        return;
      }
      remainingSeconds = Math.max(0, Math.floor(data.remaining_time || 0));
    } catch (err) {
      console.error('[Exam] Timer init error:', err);
      return;
    }

    function tickTimer() {
      if (remainingSeconds <= 0) {
        clearInterval(window.examTimerInterval);
        timeSpan.textContent = '00:00';
        showToastNotification('Exam time is over!');
        try {
          // сохраняем ответы перед финальным модальным окном
          collectAnswersFromDOM();
          window._todaytasks_answers = JSON.parse(JSON.stringify(answersMap || {}));
          showFinishModal(title, questions);
          setTimeout(() => {
            const yesBtn = document.querySelector('.Finish-modal .Finish-btn-yes');
            if (yesBtn) yesBtn.click();
            else {
              // при прямом завершении передаём snapshot через глобал
              window._todaytasks_answers = JSON.parse(JSON.stringify(answersMap || {}));
              finishTodayTasks(title, questions);
            }
          }, 80);
        } catch (modalErr) {
          console.error('[Exam] Error triggering finish modal:', modalErr);
          window._todaytasks_answers = JSON.parse(JSON.stringify(answersMap || {}));
          finishTodayTasks(title, questions);
        }
        return;
      }
      const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
      const ss = String(remainingSeconds % 60).padStart(2, '0');
      timeSpan.textContent = `${mm}:${ss}`;
      remainingSeconds--;
    }

    tickTimer();
    window.examTimerInterval = setInterval(tickTimer, 1000);
  } else {
    if (unitEl) unitEl.style.display = '';
  }

  // --- Главная логика ---
  if (!content) {
    console.error('todaytasks-content element not found');
    return;
  }
  content.innerHTML = '';

  let currentIndex = 0;
  const groups = Array.isArray(questions) ? questions : [];
  let isAnimating = false;

  /* ---------- Очистка старых swipe/key обработчиков (если были) ---------- */
  function cleanupOldHandlers() {
    try {
      if (content && content._swipeHandlers) {
        const h = content._swipeHandlers;
        if (h.touchstart) content.removeEventListener('touchstart', h.touchstart, { passive: true });
        if (h.touchmove) content.removeEventListener('touchmove', h.touchmove, { passive: true });
        if (h.touchend) content.removeEventListener('touchend', h.touchend, { passive: true });
        if (h.mousedown) content.removeEventListener('mousedown', h.mousedown);
        if (h.mousemove) content.removeEventListener('mousemove', h.mousemove);
        if (h.mouseup) content.removeEventListener('mouseup', h.mouseup);
        if (h.keydown) document.removeEventListener('keydown', h.keydown);
        delete content._swipeHandlers;
      }
    } catch (err) {
      console.warn('Error during cleanupOldHandlers:', err);
    }
  }

  /* ---------- Функции сохранения/восстановления ответов ---------- */

  // Собирает ответы с текущего видимого контента (content) и кладёт в answersMap
  function collectAnswersFromDOM() {
    try {
      // radio inputs (multiple_choice, true_false)
      content.querySelectorAll('input[type="radio"]').forEach(r => {
        if (r.name) {
          const name = r.name; // "q12"
          const base = name.replace(/^q/, '');
          if (!answersMap[base]) answersMap[base] = {};
          if (r.checked) answersMap[base].radio = r.value;
        }
      });

      // text inputs (image-answer, listening-input, general text inputs incl. write-in-blank-input)
      content.querySelectorAll('input[type="text"], input[type="password"], textarea, input.write-in-blank-input, input.image-answer, input.listening-input').forEach(inp => {
        const name = inp.name || inp.dataset.qid || inp.id;
        if (!name) return;
        const base = String(name).replace(/^q/, '');
        answersMap[base] = answersMap[base] || {};
        answersMap[base].text = inp.value;
      });

      // custom-selects
      content.querySelectorAll('.custom-select-wrapper').forEach(sw => {
        const qid = sw.dataset.qid || (sw.closest('.exam-subquestion') && sw.closest('.exam-subquestion').dataset.qid);
        if (!qid) return;
        answersMap[qid] = answersMap[qid] || {};
        answersMap[qid].select = sw.dataset.selected || (sw.querySelector('.selected-text') && sw.querySelector('.selected-text').textContent) || '';
      });

      // box-choose blanks
      content.querySelectorAll('.box-choose-blank').forEach(b => {
        const qid = b.dataset.qid || (b.id && b.id.replace(/^blank-/, ''));
        if (!qid) return;
        answersMap[qid] = answersMap[qid] || {};
        answersMap[qid].box = answersMap[qid].box || [];
        const blanks = Array.from(b.parentNode.querySelectorAll('.box-choose-blank'));
        const idx = blanks.indexOf(b);
        answersMap[qid].box[idx] = b.dataset.value || (b.classList.contains('filled') ? b.textContent : '');
      });

      // unscramble: сохраняем буквы в слотах в порядке
      content.querySelectorAll('.unscramble-inputs').forEach(inputs => {
        const qid = inputs.dataset.qid;
        if (!qid) return;
        answersMap[qid] = answersMap[qid] || {};
        const arr = Array.from(inputs.querySelectorAll('.unscramble-input')).map(slot => slot.textContent || '');
        answersMap[qid].unscramble = arr;
      });
    } catch (err) {
      console.warn('collectAnswersFromDOM error', err);
    }
  }

  // Восстанавливает ответы в новый wrapper (только для элементов внутри этого wrapper)
  function restoreAnswersToWrapper(wrapper) {
    try {
      // radios
      wrapper.querySelectorAll('input[type="radio"]').forEach(r => {
        if (!r.name) return;
        const base = r.name.replace(/^q/, '');
        const saved = answersMap[base] && answersMap[base].radio;
        if (saved !== undefined && String(saved) === String(r.value)) {
          r.checked = true;
        }
      });

      // text inputs
      wrapper.querySelectorAll('input[type="text"], input[type="password"], textarea, input.write-in-blank-input, input.image-answer, input.listening-input').forEach(inp => {
        const name = inp.name || inp.dataset.qid || inp.id;
        if (!name) return;
        const base = String(name).replace(/^q/, '');
        const saved = answersMap[base] && answersMap[base].text;
        if (saved !== undefined) inp.value = saved;
      });

      // custom-selects
      wrapper.querySelectorAll('.custom-select-wrapper').forEach(sw => {
        const qid = sw.dataset.qid;
        if (!qid) return;
        const saved = answersMap[qid] && answersMap[qid].select;
        if (saved !== undefined && saved !== '') {
          const textSpan = sw.querySelector('.selected-text');
          if (textSpan) textSpan.textContent = saved;
          sw.dataset.selected = saved;
        }
      });

      // box-choose blanks
      wrapper.querySelectorAll('.box-choose-blank').forEach(blank => {
        const qid = blank.dataset.qid || (blank.id && blank.id.replace(/^blank-/, ''));
        if (!qid) return;
        const blanks = Array.from(blank.parentNode.querySelectorAll('.box-choose-blank'));
        const idx = blanks.indexOf(blank);
        const savedArr = answersMap[qid] && answersMap[qid].box;
        if (savedArr && savedArr[idx]) {
          const val = savedArr[idx];
          blank.textContent = val;
          blank.classList.add('filled');
          blank.dataset.value = val;
          blank.classList.remove('highlight-pending');
          const optionsDiv = blank.closest('.exam-subquestion') && blank.closest('.exam-subquestion').querySelector('.box-choose-options');
          if (optionsDiv) {
            const optToRemove = Array.from(optionsDiv.querySelectorAll('.box-choose-option')).find(o => o.textContent.trim() === val.trim());
            if (optToRemove) optToRemove.remove();
          }
        }
      });

      // unscramble restore
      wrapper.querySelectorAll('.unscramble-inputs').forEach(inputContainer => {
        const qid = inputContainer.dataset.qid;
        if (!qid) return;
        const saved = answersMap[qid] && answersMap[qid].unscramble;
        if (saved && saved.length) {
          const letterContainer = inputContainer.previousElementSibling && inputContainer.previousElementSibling.classList.contains('unscramble-letters')
            ? inputContainer.previousElementSibling
            : inputContainer.parentNode.querySelector('.unscramble-letters');
          if (!letterContainer) return;
          const letterEls = Array.from(letterContainer.querySelectorAll('.unscramble-letter'));
          saved.forEach((letter, slotIndex) => {
            if (!letter) return;
            const match = letterEls.find(le => le.dataset.letter === letter && !le.classList.contains('used'));
            if (match) {
              const slot = inputContainer.querySelectorAll('.unscramble-input')[slotIndex];
              if (slot) {
                slot.textContent = match.dataset.letter;
                slot.classList.add('filled');
                slot.dataset.letterIndex = match.dataset.index;
                match.classList.add('used');
              }
            }
          });
        }
      });

    } catch (err) {
      console.warn('restoreAnswersToWrapper error', err);
    }
  }

  /* ---------- Функция: создает/пересоздаёт прогресс-бар в корне (вне header) ---------- */
  function renderProgressBarInRoot(percent) {
    const old = document.getElementById('tasks-count-wrapper-root');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const wrapper = document.createElement('div');
    wrapper.id = 'tasks-count-wrapper-root';
    wrapper.className = 'tasks-count-wrapper';
    wrapper.setAttribute('aria-hidden', 'false');

    const bar = document.createElement('div');
    bar.id = 'tasks-count-bar';
    bar.className = 'tasks-count-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(percent));

    const fill = document.createElement('div');
    fill.className = 'tasks-count-fill';
    fill.style.width = `${percent}%`;
    bar.appendChild(fill);

    const pct = document.createElement('div');
    pct.id = 'tasks-count-percentage';
    pct.className = 'tasks-count-percentage';
    pct.setAttribute('tabindex', '-1');
    pct.textContent = `${percent}%`;

    wrapper.appendChild(bar);
    wrapper.appendChild(pct);

    if (pageRoot) {
      if (headerContainer && headerContainer.parentNode === pageRoot) {
        if (headerContainer.nextSibling) pageRoot.insertBefore(wrapper, headerContainer.nextSibling);
        else pageRoot.appendChild(wrapper);
      } else {
        const contentEl = document.getElementById('todaytasks-content');
        if (contentEl && contentEl.parentNode === pageRoot) pageRoot.insertBefore(wrapper, contentEl);
        else pageRoot.appendChild(wrapper);
      }
    } else {
      const contentEl = document.getElementById('todaytasks-content');
      if (contentEl && contentEl.parentNode) contentEl.parentNode.insertBefore(wrapper, contentEl);
      else document.body.appendChild(wrapper);
    }

    // Анимация плашки
    requestAnimationFrame(() => {
      pct.classList.remove('pct-animate');
      setTimeout(() => pct.classList.add('pct-animate'), 20);
      setTimeout(() => pct.classList.remove('pct-animate'), 700);
    });
  }

  function updateProgressIndicator() {
    const percent = groups.length > 0 ? Math.round(((currentIndex + 1) / groups.length) * 100) : 0;
    renderProgressBarInRoot(percent);
  }

  /* ---------- Переход к индексу (находится ДО регистрации обработчиков) ---------- */
  function goToIndex(idx, direction = 'left') {
    if (isAnimating) return;
    if (idx < 0 || idx >= groups.length) return;
    const prevIndex = currentIndex;
    // перед переключением — собираем ответы с текущей страницы
    collectAnswersFromDOM();
    currentIndex = idx;
    renderGroup(currentIndex, direction, prevIndex);
    // Пересоздаём прогресс-бар при каждом перемещении
    updateProgressIndicator();
  }

  /* ---------- Рендер группы (блок вопроса) ---------- */
  function renderGroup(index, direction = 'left', prevIndex = null) {
    const q = groups[index];
    if (!q) return;
    const newWrapper = document.createElement('div');
    newWrapper.className = 'exam-question-block new-block';

    // reading
    if (q.type === 'reading' && q.text) {
      const rich = document.createElement('div');
      rich.className = 'exam-parent-question';
      rich.innerHTML = q.text;
      newWrapper.appendChild(rich);
    }

    // listening top-level audio
    if (q.type === 'listening' && q.audio) {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="listening-audio">
          <div class="custom-audio-player">
            <button class="custom-play-btn"><i class="fas fa-play"></i></button>
            <div class="custom-audio-waves"><div class="progress"></div></div>
            <div class="custom-time-display">0:00</div>
          </div>
          <audio src="${q.audio}" preload="metadata" style="display:none;"></audio>
        </div>`;
      newWrapper.appendChild(div.firstElementChild);
    }

    // video
    if (q.type === 'video' && (q['link-youtube'] || q['local-link'])) {
      const div = document.createElement('div');
      div.className = 'video-question';
      if (q['link-youtube'] && q['link-youtube'].includes('<iframe')) {
        div.innerHTML = `<div class="video-player">${q['link-youtube']}</div>`;
      } else if (q['local-link']) {
        div.innerHTML = `
          <div class="video-player">
            <video controls width="100%" preload="metadata">
              <source src="${q['local-link']}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>`;
      }
      newWrapper.appendChild(div.firstElementChild);
    }

    if (q.text && q.type !== 'reading') {
      const heading = document.createElement('h3');
      heading.className = 'question-title';
      heading.innerHTML = `${index + 1}. ${q.text}`;
      newWrapper.appendChild(heading);
    }

    const subList = Array.isArray(q.subquestions) ? q.subquestions : [q];
    const groupedSelectOptions = [];
    const groupedWriteIn = [];
    const groupedBoxChoose = [];

    subList.forEach(sub => {
      if (sub.type === 'select-options') groupedSelectOptions.push(sub);
      else if (sub.type === 'write-in-blank') groupedWriteIn.push(sub);
      else if (sub.type === 'box-choose') groupedBoxChoose.push(sub);
    });

    subList.forEach((sub) => {
      if (sub.type === 'select-options' || sub.type === 'write-in-blank' || sub.type === 'box-choose') return;
      const subDiv = document.createElement('div');
      subDiv.className = 'exam-subquestion';

      if (sub.type !== 'unscramble') {
        const p = document.createElement('p');
        p.className = 'question-text';
        p.innerHTML = `${sub.id || 'Q'}. ${sub.text || ''}`;
        subDiv.appendChild(p);
      }

      const groupDiv = document.createElement('div');
      groupDiv.className = 'question-options';

      if (['multiple_choice', 'true_false'].includes(sub.type)) {
        (sub.options || ['True', 'False']).forEach((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const id = `opt-${sub.id}-${letter}`;
          groupDiv.innerHTML += `
            <div class="option-group">
              <input type="radio" name="q${sub.id}" value="${opt}" id="${id}">
              <label for="${id}">
                <span class="option-letter">${letter}</span>
                <span class="option-text">${opt}</span>
              </label>
            </div>`;
        });
      } else if (sub.type === 'unscramble') {
        const letters = sub.text.trim().split('').filter(ch => ch !== ' ');
        const shuffled = [...letters].sort(() => Math.random() - 0.5);
        const letterContainer = document.createElement('div');
        const inputContainer = document.createElement('div');
        letterContainer.className = 'unscramble-letters';
        inputContainer.className = 'unscramble-inputs';
        inputContainer.dataset.qid = sub.id;

        shuffled.forEach((letter, index) => {
          const span = document.createElement('span');
          span.className = 'unscramble-letter';
          span.textContent = letter;
          span.dataset.index = index;
          span.dataset.letter = letter;
          letterContainer.appendChild(span);
        });

        letters.forEach((_, index) => {
          const slot = document.createElement('span');
          slot.className = 'unscramble-input';
          slot.dataset.index = index;
          inputContainer.appendChild(slot);
        });

        groupDiv.appendChild(letterContainer);
        groupDiv.appendChild(inputContainer);

        letterContainer.querySelectorAll('.unscramble-letter').forEach(letterEl => {
          letterEl.onclick = () => {
            if (letterEl.classList.contains('used')) return;
            const emptySlot = inputContainer.querySelector('.unscramble-input:not(.filled)');
            if (emptySlot) {
              emptySlot.textContent = letterEl.dataset.letter;
              emptySlot.classList.add('filled');
              emptySlot.dataset.letterIndex = letterEl.dataset.index;
              letterEl.classList.add('used');
            }
          };
        });
        inputContainer.querySelectorAll('.unscramble-input').forEach(inputEl => {
          inputEl.onclick = () => {
            if (!inputEl.classList.contains('filled')) return;
            const idx = inputEl.dataset.letterIndex;
            const letterEl = letterContainer.querySelector(`.unscramble-letter[data-index="${idx}"]`);
            if (letterEl) letterEl.classList.remove('used');
            inputEl.textContent = '';
            inputEl.classList.remove('filled');
            delete inputEl.dataset.letterIndex;
          };
        });
      } else if (sub.type === 'picture') {
        if (sub.image) groupDiv.innerHTML += `<img src="${sub.image}" alt="Image" class="question-image">`;
        groupDiv.innerHTML += `<input type="text" name="q${sub.id}" class="image-answer" placeholder="Answer...">`;
      } else if (sub.type === 'listening') {
        groupDiv.innerHTML = `<input type="text" name="q${sub.id}" class="listening-input" placeholder="Your answer...">`;
      }

      subDiv.appendChild(groupDiv);
      newWrapper.appendChild(subDiv);
    });

    if (groupedWriteIn.length) {
      const subDiv = document.createElement('div');
      subDiv.className = 'exam-subquestion';
      groupedWriteIn.forEach(sub => {
        const p = document.createElement('p');
        p.className = 'question-text';
        p.innerHTML = `${sub.id}. ${sub.text.replace('____', `<input type="text" class="write-in-blank-input" name="q${sub.id}" autocomplete="off">`)}`;
        subDiv.appendChild(p);
      });
      newWrapper.appendChild(subDiv);
    }

    if (groupedSelectOptions.length) {
      const subDiv = document.createElement('div');
      subDiv.className = 'exam-subquestion';
      groupedSelectOptions.forEach(sub => {
        const p = document.createElement('p');
        p.className = 'question-text';

        const match = sub.text.match(/^(.*?)\((.*?)\)(.*)$/);
        if (!match) {
          console.warn('Invalid select-options format:', sub.text);
          return;
        }

        const fullText = match[1].trim();
        const optionsStr = match[2].trim();
        const after = match[3].trim();

        const parts = fullText.split('____');
        if (parts.length < 2) {
          console.warn('No ____ found in select-options text:', sub.text);
          return;
        }

        const before = parts[0];
        const afterBlank = parts[1];

        const options = optionsStr.split('/').map(opt => opt.trim());
        const cleanOptions = options.map(opt => opt.replace(/\*\*/g, ''));

        const selectWrapper = document.createElement('div');
        selectWrapper.className = 'custom-select-wrapper';
        selectWrapper.dataset.qid = sub.id;

        const display = document.createElement('div');
        display.className = 'custom-select-display';

        const textSpan = document.createElement('span');
        textSpan.className = 'selected-text';
        textSpan.textContent = '';

        const icon = document.createElement('i');
        icon.className = 'fas fa-caret-down';

        display.appendChild(textSpan);
        display.appendChild(icon);

        const dropdown = document.createElement('div');
        dropdown.className = 'custom-select-dropdown';

        cleanOptions.forEach(optionText => {
          const option = document.createElement('div');
          option.className = 'custom-select-option';
          option.textContent = optionText;
          option.onclick = (e) => {
            e.stopPropagation();
            textSpan.textContent = optionText;
            selectWrapper.dataset.selected = optionText;
            selectWrapper.classList.remove('open');
            if (icon.parentNode) icon.remove();
          };
          dropdown.appendChild(option);
        });

        display.onclick = (e) => {
          e.stopPropagation();
          const isOpen = selectWrapper.classList.contains('open');
          document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
          if (!isOpen) {
            selectWrapper.classList.add('open');
            document.addEventListener('click', function closeDropdown(ev) {
              if (!selectWrapper.contains(ev.target)) {
                selectWrapper.classList.remove('open');
                document.removeEventListener('click', closeDropdown);
              }
            }, { once: true });
          }
        };

        selectWrapper.appendChild(display);
        selectWrapper.appendChild(dropdown);

        const idSpan = document.createElement('span');
        idSpan.textContent = `${sub.id}. `;
        p.appendChild(idSpan);

        const beforeSpan = document.createElement('span');
        beforeSpan.textContent = before;
        p.appendChild(beforeSpan);

        p.appendChild(selectWrapper);

        const afterBlankSpan = document.createElement('span');
        afterBlankSpan.textContent = afterBlank;
        p.appendChild(afterBlankSpan);

        if (after) {
          const afterSpan = document.createElement('span');
          afterSpan.textContent = ` ${after}`;
          p.appendChild(afterSpan);
        }

        subDiv.appendChild(p);
      });
      newWrapper.appendChild(subDiv);
    }

    if (groupedBoxChoose.length) {
      const subDiv = document.createElement('div');
      subDiv.className = 'exam-subquestion';
      const optionsDiv = document.createElement('div');
      optionsDiv.className = 'box-choose-options';
      let selected = null;

      function handleOptionClick(optEl) {
        const val = optEl.textContent;
        if (selected === val) {
          optEl.classList.remove('selected');
          selected = null;
          return;
        }
        optionsDiv.querySelectorAll('.box-choose-option').forEach(el => el.classList.remove('selected'));
        optEl.classList.add('selected');
        selected = val;
        subDiv.querySelectorAll('.box-choose-blank').forEach(blank => {
          if (!blank.textContent || blank.textContent === '_____') {
            blank.classList.add('highlight-pending');
            blank.style.borderColor = '#4a90e2';
          }
        });
      }

      const allOpts = [...new Set(groupedBoxChoose.flatMap(s => (s.options && s.options.length) ? s.options : (q.options || [])))];
      allOpts.forEach((opt, i) => {
        const span = document.createElement('span');
        span.className = 'box-choose-option';
        span.textContent = opt;
        span.style.setProperty('--index', i);
        span.onclick = () => handleOptionClick(span);
        optionsDiv.appendChild(span);
      });
      subDiv.appendChild(optionsDiv);

      groupedBoxChoose.forEach(sub => {
        const p = document.createElement('p');
        p.className = 'question-text';
        const id = `blank-${sub.id}`;
        p.innerHTML = `${sub.id}. ${sub.text.replace('____', `<span class="box-choose-blank" id="${id}" data-qid="${sub.id}">_____</span>`)}`;
        subDiv.appendChild(p);
      });

      setTimeout(() => {
        subDiv.querySelectorAll('.box-choose-blank').forEach(blank => {
          blank.onclick = () => {
            if (blank.classList.contains('filled')) {
              const restored = blank.dataset.value;
              const restoreSpan = document.createElement('span');
              restoreSpan.className = 'box-choose-option';
              restoreSpan.textContent = restored;
              restoreSpan.onclick = () => handleOptionClick(restoreSpan);
              optionsDiv.appendChild(restoreSpan);
              blank.textContent = '_____';
              blank.classList.remove('filled', 'highlight-pending');
              blank.style.borderColor = '';
              delete blank.dataset.value;
              selected = null;
              return;
            }
            if (!selected) return;
            blank.textContent = selected;
            blank.classList.add('filled');
            blank.classList.remove('highlight-pending');
            blank.dataset.value = selected;
            blank.style.borderColor = '';
            optionsDiv.querySelectorAll('.box-choose-option').forEach(optEl => {
              if (optEl.textContent === selected) optEl.remove();
            });
            selected = null;
          };
        });
      }, 0);

      newWrapper.appendChild(subDiv);
    }

    // Анимация между старым и новым блоком
    const oldChild = content.querySelector('.exam-question-block');
    if (!oldChild) {
      newWrapper.classList.add(direction === 'left' ? 'slide-in-right' : 'slide-in-left');
      content.appendChild(newWrapper);
      // Восстанавливаем ответы (если были)
      restoreAnswersToWrapper(newWrapper);
      initCustomAudioPlayers();
      newWrapper.addEventListener('animationend', function _n() {
        newWrapper.classList.remove('slide-in-right', 'slide-in-left', 'new-block');
        newWrapper.removeEventListener('animationend', _n);
      });
    } else {
      // перед анимацией удаления — сохраним текущие ответы
      collectAnswersFromDOM();
      isAnimating = true;
      oldChild.classList.add(direction === 'left' ? 'slide-out-left' : 'slide-out-right');
      const onOldDone = () => {
        if (oldChild && oldChild.parentNode) oldChild.parentNode.removeChild(oldChild);
        newWrapper.classList.add(direction === 'left' ? 'slide-in-right' : 'slide-in-left');
        content.appendChild(newWrapper);
        // Restore saved answers
        restoreAnswersToWrapper(newWrapper);
        initCustomAudioPlayers();
        newWrapper.addEventListener('animationend', function _n2() {
          newWrapper.classList.remove('slide-in-right', 'slide-in-left', 'new-block');
          newWrapper.removeEventListener('animationend', _n2);
          isAnimating = false;
        });
        oldChild.removeEventListener('animationend', onOldDone);
      };
      oldChild.addEventListener('animationend', onOldDone);
      setTimeout(() => {
        if (isAnimating) onOldDone();
      }, 600);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Swipe / drag обработчики с регистрацией/удалением ---------- */
  function attachSwipeHandlers() {
    // Перед регистрацией — удалим старые (если есть)
    cleanupOldHandlers();

    let startX = 0;
    let startY = 0;
    let isTouch = false;
    let moved = false;
    const threshold = 60;

    // Touch handlers
    const touchstart = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      isTouch = true;
      moved = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const touchmove = (e) => {
      if (!isTouch || !e.touches || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) moved = true;
    };
    const touchend = (e) => {
      if (!isTouch) return;
      const touch = e.changedTouches && e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      if (!moved) { isTouch = false; return; }
      if (dx < -threshold) goToIndex(Math.min(groups.length - 1, currentIndex + 1), 'left');
      else if (dx > threshold) goToIndex(Math.max(0, currentIndex - 1), 'right');
      isTouch = false;
      moved = false;
    };

    // Mouse handlers
    let mouseDown = false;
    const mousedown = (e) => { mouseDown = true; startX = e.clientX; startY = e.clientY; moved = false; };
    const mousemove = (e) => { if (!mouseDown) return; const dx = e.clientX - startX; const dy = e.clientY - startY; if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) moved = true; };
    const mouseup = (e) => {
      if (!mouseDown) return;
      const dx = e.clientX - startX;
      if (!moved) { mouseDown = false; return; }
      if (dx < -threshold) goToIndex(Math.min(groups.length - 1, currentIndex + 1), 'left');
      else if (dx > threshold) goToIndex(Math.max(0, currentIndex - 1), 'right');
      mouseDown = false; moved = false;
    };

    // Keydown handler
    const keydown = (e) => {
      if (e.key === 'ArrowLeft') goToIndex(Math.max(0, currentIndex - 1), 'right');
      else if (e.key === 'ArrowRight') goToIndex(Math.min(groups.length - 1, currentIndex + 1), 'left');
    };

    // Сохраняем ссылки на обработчики для последующей очистки
    content._swipeHandlers = {
      touchstart, touchmove, touchend,
      mousedown, mousemove, mouseup,
      keydown
    };

    // Регистрация слушателей
    content.addEventListener('touchstart', touchstart, { passive: true });
    content.addEventListener('touchmove', touchmove, { passive: true });
    content.addEventListener('touchend', touchend, { passive: true });

    content.addEventListener('mousedown', mousedown);
    content.addEventListener('mousemove', mousemove);
    content.addEventListener('mouseup', mouseup);

    document.addEventListener('keydown', keydown);
  }

  // Инициализация: первый рендер + регистрация обработчиков + прогресс
  if (groups.length > 0) {
    currentIndex = 0;
    renderGroup(currentIndex, 'left', null);
  } else {
    content.innerHTML = '<p class="no-questions">No questions available.</p>';
  }

  // Создаём/обновляем прогресс (пересоздаётся внутри renderProgressBarInRoot)
  updateProgressIndicator();

  // Привязка свайпов — теперь точно без дублирования и goToIndex доступен
  attachSwipeHandlers();

  // Finish / Done / Floating
  const finishBtnEl = document.getElementById('finish-tasks-btn');
  if (finishBtnEl) {
    finishBtnEl.onclick = () => {
      const btn = document.getElementById('floating-finish-btn');
      if (btn) btn.style.display = 'none';
      // Сохраним перед завершением
      collectAnswersFromDOM();
      // snapshot в глобал — чтобы существующая логика finish могла его прочитать
      window._todaytasks_answers = JSON.parse(JSON.stringify(answersMap || {}));
      showFinishModal(title, questions);
    };
  }

  const doneBtnEl = document.getElementById('done-tasks-btn');
  if (doneBtnEl) {
    doneBtnEl.onclick = () => {
      showPage('today');
      content.innerHTML = '';
      doneBtnEl.style.display = 'none';
      const finishBtn = document.getElementById('finish-tasks-btn');
      if (finishBtn) finishBtn.style.display = 'inline-block';
      const floating = document.getElementById('floating-finish-btn');
      if (floating) floating.style.display = 'none';
    };
  }

  let floatingBtn = document.getElementById('floating-finish-btn');
  if (!floatingBtn) {
    floatingBtn = document.createElement('button');
    floatingBtn.id = 'floating-finish-btn';
    floatingBtn.innerHTML = '<i class="fas fa-check"></i> Finish Task';
    document.body.appendChild(floatingBtn);
  }
  floatingBtn.style.display = 'block';
  floatingBtn.onclick = () => {
    floatingBtn.style.display = 'none';
    // Сохраним перед завершением
    collectAnswersFromDOM();
    window._todaytasks_answers = JSON.parse(JSON.stringify(answersMap || {}));
    showFinishModal(title, questions);
  };

  // Инициализация аудио и прочих интерактивов
  initCustomAudioPlayers();
}



// --------------------
// Модалка Finish-modal (обновлённая — учитывает ответы со всех страниц)
//
// Использует window._todaytasks_answers (если есть) и объединяет с текущим DOM.
// Перед вызовом finishTodayTasks сохраняет snapshot в window._todaytasks_answers
// и также передаёт его как третий аргумент (backward-compatible).
// --------------------
function showFinishModal(taskName, questions) {
  // helper: получить ответ из DOM для конкретного под-вопроса
  function getDomAnswerForSub(sub) {
    const qid = String(sub.id);
    const ans = {};

    // custom-select
    const selectEl = document.querySelector(`.custom-select-wrapper[data-qid="${qid}"]`);
    if (selectEl) {
      const sel = selectEl.dataset.selected || (selectEl.querySelector('.selected-text') && selectEl.querySelector('.selected-text').textContent);
      if (sel && String(sel).trim()) ans.select = String(sel).trim();
    }

    // radio (multiple_choice / true_false)
    const radio = document.querySelector(`input[name="q${qid}"]:checked`);
    if (radio) ans.radio = radio.value;

    // text / password / textarea (write-in-blank, picture, listening, general)
    const textInput = document.querySelector(`input[name="q${qid}"], textarea[name="q${qid}"]`);
    if (textInput && String(textInput.value || '').trim()) ans.text = String(textInput.value).trim();

    // box-choose blanks (may be several)
    const blanks = Array.from(document.querySelectorAll(`.box-choose-blank[data-qid="${qid}"]`));
    if (blanks.length) {
      ans.box = blanks.map(b => {
        if (b.dataset && b.dataset.value) return b.dataset.value;
        if (b.classList && b.classList.contains('filled')) return (b.textContent || '').trim();
        return '';
      });
    }

    // unscramble inputs
    const unscrambleSlots = Array.from(document.querySelectorAll(`.unscramble-inputs[data-qid="${qid}"] .unscramble-input`));
    if (unscrambleSlots.length) {
      ans.unscramble = unscrambleSlots.map(s => (s.textContent || '').trim());
    }

    return ans;
  }

  // Берём глобальный snapshot (если есть) — ключи как строки
  const globalAnswers = (window._todaytasks_answers && typeof window._todaytasks_answers === 'object')
    ? JSON.parse(JSON.stringify(window._todaytasks_answers))
    : {};

  // Собираем mergedAnswers = globalAnswers + данные из DOM (DOM перекрывает)
  const mergedAnswers = Object.assign({}, globalAnswers);

  // проходим все вопросы и собираем DOM-ответы (на случай, если есть ответы на видимой странице)
  questions.forEach(q => {
    const subList = Array.isArray(q.subquestions) ? q.subquestions : [q];
    subList.forEach(sub => {
      const qid = String(sub.id);
      const domAns = getDomAnswerForSub(sub);
      if (!mergedAnswers[qid]) mergedAnswers[qid] = {};
      // наложение: значения из DOM перезаписывают глобальные (если есть)
      Object.keys(domAns).forEach(k => {
        mergedAnswers[qid][k] = domAns[k];
      });
    });
  });

  // Подсчёт answered / total
  let answeredCount = 0;
  let totalCount = 0;

  questions.forEach(q => {
    const subList = Array.isArray(q.subquestions) ? q.subquestions : [q];
    subList.forEach(sub => {
      totalCount++;
      const qid = String(sub.id);
      const saved = mergedAnswers[qid] || {};

      // Функция-помощник для проверки "пусто"
      const hasText = v => (v !== undefined && v !== null && String(v).trim() !== '');
      const hasBoxAny = arr => Array.isArray(arr) && arr.some(x => hasText(x));
      const hasUnscrambleAny = arr => Array.isArray(arr) && arr.some(x => hasText(x));

      let isAnswered = false;

      if (sub.type === 'select-options') {
        if (hasText(saved.select)) isAnswered = true;
        else {
          // fallback: check DOM again quickly (should be covered above, but double-check)
          const sel = document.querySelector(`.custom-select-wrapper[data-qid="${qid}"]`)?.dataset.selected;
          if (sel && String(sel).trim()) isAnswered = true;
        }
      } else if (sub.type === 'write-in-blank') {
        if (hasText(saved.text)) isAnswered = true;
        else {
          const input = document.querySelector(`input[name="q${qid}"]`);
          if (input && String(input.value || '').trim()) isAnswered = true;
        }
      } else if (sub.type === 'box-choose') {
        if (hasBoxAny(saved.box)) isAnswered = true;
        else {
          const blank = document.querySelectorAll(`.box-choose-blank[data-qid="${qid}"]`);
          if (blank && Array.from(blank).some(b => b.classList.contains('filled'))) isAnswered = true;
        }
      } else if (['multiple_choice', 'true_false'].includes(sub.type)) {
        if (hasText(saved.radio)) isAnswered = true;
        else {
          const checked = document.querySelector(`input[name="q${qid}"]:checked`);
          if (checked) isAnswered = true;
        }
      } else if (sub.type === 'unscramble') {
        if (hasUnscrambleAny(saved.unscramble)) isAnswered = true;
        else {
          const filled = document.querySelectorAll(`.unscramble-inputs[data-qid="${qid}"] .filled`).length;
          if (filled > 0) isAnswered = true;
        }
      } else if (sub.type === 'picture' || sub.type === 'listening') {
        if (hasText(saved.text)) isAnswered = true;
        else {
          const input = document.querySelector(`input[name="q${qid}"]`);
          if (input && String(input.value || '').trim()) isAnswered = true;
        }
      } else {
        // default fallback: consider any stored value as answered
        if (Object.keys(saved).length > 0) {
          // if any non-empty field found
          if (hasText(saved.text) || hasText(saved.radio) || hasText(saved.select) || hasBoxAny(saved.box) || hasUnscrambleAny(saved.unscramble)) {
            isAnswered = true;
          } else {
            // check DOM generically
            const input = document.querySelector(`input[name="q${qid}"], textarea[name="q${qid}"]`);
            const checked = document.querySelector(`input[name="q${qid}"]:checked`);
            if ((input && String(input.value || '').trim()) || checked) isAnswered = true;
          }
        } else {
          // no saved — check DOM minimal
          const input = document.querySelector(`input[name="q${qid}"], textarea[name="q${qid}"]`);
          const checked = document.querySelector(`input[name="q${qid}"]:checked`);
          if ((input && String(input.value || '').trim()) || checked) isAnswered = true;
        }
      }

      if (isAnswered) answeredCount++;
    });
  });

  const unansweredCount = Math.max(0, totalCount - answeredCount);

  // Удаляем старую модалку если есть
  const oldModal = document.querySelector('.Finish-modal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.className = 'Finish-modal';
  modal.innerHTML = `
    <div class="Finish-modal-content">
      <h2>Are you sure that you want to finish?</h2>
      <p>Please note that once you finish the <b>${taskName}</b>, you will not be able to take it again</p>
      ${unansweredCount > 0 ? `<div class="Finish-warning">You did not answer ${unansweredCount} out of ${totalCount} questions!</div>` : ''}
      <div class="Finish-modal-buttons">
        <button class="Finish-btn-no">No</button>
        <button class="Finish-btn-yes">Yes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.Finish-btn-no').onclick = () => {
    modal.remove();
    const btn = document.getElementById('floating-finish-btn');
    if (btn) btn.style.display = 'block';
  };

  modal.querySelector('.Finish-btn-yes').onclick = () => {
    modal.remove();

    // Сохраняем snapshot в глобал (чтобы finishTodayTasks / сервер / другие функции могли получить все ответы)
    window._todaytasks_answers = JSON.parse(JSON.stringify(mergedAnswers || {}));

    // Если finishTodayTasks умеет принимать третий аргумент - передадим snapshot. И в любом случае глобал уже обновлён.
    try {
      finishTodayTasks(taskName, questions, JSON.parse(JSON.stringify(mergedAnswers || {})));
    } catch (err) {
      // на всякий случай, если finishTodayTasks не принимает аргументы или бросает — всё равно вызовем без аргумента
      try {
        finishTodayTasks(taskName, questions);
      } catch (err2) {
        console.error('finishTodayTasks error:', err2);
      }
    }
  };
}


function getInstructionForType(type) {
  switch (type) {
    case 'multiple_choice': return 'Choose the correct option.';
    case 'true_false': return 'Select True or False.';
    case 'write-in-blank': return 'Fill in the blank with the correct word.';
    case 'unscramble': return 'Unscramble the letters to form the correct word.';
    case 'box-choose': return 'Click on a blank, then select a word from the box.';
    case 'question': return 'Write your answer in the box.';
    case 'picture': return 'Look at the image and answer.';
    default: return '';
  }
}

// ----------------------------
// 3. Сбор ответов и отправка на сервер с результатом и ошибками
// ----------------------------
// ----------------------------
// 3. Сбор ответов и отправка на сервер с результатом и ошибками
// Обновлённая: принимает optional answersSnapshot (from showFinishModal),
// объединяет snapshot + текущий DOM (DOM значения перекрывают snapshot),
// нормализует и отправляет полный набор ответов.
// Добавлено: проигрывание звука неудачи /static/music/lagapet.ogg если percent < 79
// ----------------------------
function finishTodayTasks(title, questions, answersSnapshot = null) {
  try {
    initExamSecurity(false);
    updateStrikes();
    showNavigation();

    const content = document.getElementById('todaytasks-content');
    const btn = document.getElementById('floating-finish-btn');
    if (btn) btn.style.display = 'none';

    // 1) Берём глобальный snapshot (переданный или из window)
    const globalAnswersRaw = answersSnapshot && typeof answersSnapshot === 'object'
      ? JSON.parse(JSON.stringify(answersSnapshot))
      : (window._todaytasks_answers && typeof window._todaytasks_answers === 'object'
          ? JSON.parse(JSON.stringify(window._todaytasks_answers))
          : {});

    // 2) Сбор ответов из текущего DOM (видимой страницы)
    const domAnswers = {}; // структура похожа на answersMap: { qid: { text, radio, select, box:[], unscramble:[] } }
    if (content) {
      try {
        // radios (multiple_choice, true_false)
        content.querySelectorAll('input[type="radio"]').forEach(r => {
          if (!r.name) return;
          const qid = String(r.name).replace(/^q/, '');
          domAnswers[qid] = domAnswers[qid] || {};
          if (r.checked) domAnswers[qid].radio = r.value;
        });

        // text/password/textarea (write-in-blank, picture, listening, general)
        content.querySelectorAll('input[type="text"], input[type="password"], textarea').forEach(inp => {
          const name = inp.name || inp.dataset.qid || inp.id;
          if (!name) return;
          const qid = String(name).replace(/^q/, '');
          domAnswers[qid] = domAnswers[qid] || {};
          const v = String(inp.value || '').trim();
          if (v) domAnswers[qid].text = v;
        });

        // listening specific inputs (class)
        content.querySelectorAll('.listening-input').forEach(inp => {
          const name = inp.name || inp.dataset.qid || inp.id;
          if (!name) return;
          const qid = String(name).replace(/^q/, '');
          domAnswers[qid] = domAnswers[qid] || {};
          const v = String(inp.value || '').trim();
          if (v) domAnswers[qid].text = v;
        });

        // custom-select wrappers
        content.querySelectorAll('.custom-select-wrapper').forEach(sw => {
          const qid = sw.dataset.qid;
          if (!qid) return;
          domAnswers[qid] = domAnswers[qid] || {};
          const sel = sw.dataset.selected || (sw.querySelector('.selected-text') && sw.querySelector('.selected-text').textContent);
          if (sel && String(sel).trim()) domAnswers[qid].select = String(sel).trim();
        });

        // box-choose blanks (possibly multiple blanks per qid)
        content.querySelectorAll('.box-choose-blank').forEach(b => {
          const qid = b.dataset.qid || (b.id && b.id.replace(/^blank-/, ''));
          if (!qid) return;
          domAnswers[qid] = domAnswers[qid] || {};
          domAnswers[qid].box = domAnswers[qid].box || [];
          const blanks = Array.from(b.parentNode.querySelectorAll('.box-choose-blank'));
          const idx = blanks.indexOf(b);
          const val = (b.dataset && b.dataset.value) ? b.dataset.value : (b.classList.contains('filled') ? (b.textContent || '').trim() : '');
          domAnswers[qid].box[idx] = val || '';
        });

        // unscramble
        content.querySelectorAll('.unscramble-inputs').forEach(group => {
          const qid = group.dataset.qid;
          if (!qid) return;
          domAnswers[qid] = domAnswers[qid] || {};
          const arr = Array.from(group.querySelectorAll('.unscramble-input')).map(s => (s.textContent || '').trim());
          domAnswers[qid].unscramble = arr;
        });

      } catch (err) {
        console.warn('finishTodayTasks: error collecting DOM answers', err);
      }
    }

    // 3) Merge: globalAnswersRaw + domAnswers -> mergedAnswersStructured
    // DOM overrides global for same qid
    const mergedStructured = JSON.parse(JSON.stringify(globalAnswersRaw || {})); // shallow copy
    Object.keys(domAnswers).forEach(qid => {
      mergedStructured[qid] = mergedStructured[qid] || {};
      // If domAnswers[qid] itself may be primitive (older snapshots), normalize:
      if (typeof domAnswers[qid] !== 'object' || Array.isArray(domAnswers[qid])) {
        // assume primitive text or similar
        mergedStructured[qid].text = String(domAnswers[qid]);
      } else {
        Object.keys(domAnswers[qid]).forEach(k => {
          mergedStructured[qid][k] = domAnswers[qid][k];
        });
      }
    });

    // 4) Normalize to flat answers mapping expected by backend: answers[qid] = string
    const answers = {};
    Object.keys(mergedStructured).forEach(qid => {
      const v = mergedStructured[qid];
      if (v === null || v === undefined) return;
      // if v is primitive (string/number) — use it
      if (typeof v === 'string' || typeof v === 'number') {
        const s = String(v).trim();
        if (s) answers[qid] = s;
        return;
      }
      // prefer explicit fields in order: radio -> select -> text -> box -> unscramble
      if (v.radio && String(v.radio).trim()) {
        answers[qid] = String(v.radio).trim();
        return;
      }
      if (v.select && String(v.select).trim()) {
        answers[qid] = String(v.select).trim();
        return;
      }
      if (v.text && String(v.text).trim()) {
        answers[qid] = String(v.text).trim();
        return;
      }
      if (Array.isArray(v.box) && v.box.length) {
        // choose first non-empty value (common case: single blank). Fallback: join with '||'
        const firstNonEmpty = v.box.find(x => x !== undefined && x !== null && String(x).trim() !== '');
        if (firstNonEmpty !== undefined) {
          answers[qid] = String(firstNonEmpty).trim();
          return;
        } else {
          // fallback join
          const joined = v.box.map(x => String(x || '').trim()).filter(x => x !== '').join('||');
          if (joined) answers[qid] = joined;
          return;
        }
      }
      if (Array.isArray(v.unscramble) && v.unscramble.length) {
        const joined = v.unscramble.map(x => String(x || '')).join('');
        if (joined.trim()) answers[qid] = joined;
        return;
      }
      // As last resort, check nested fields for strings
      const fallback = ['answer', 'value'].reduce((acc, key) => acc || (v[key] && String(v[key]).trim()), null);
      if (fallback) answers[qid] = String(fallback).trim();
    });

    // 5) Also ensure we include any answers that are present only in DOM but not in mergedStructured (should be covered)
    // (already merged above)

    // 6) Final checks (errors optional — preserved commented style)
    const errors = [];
    // you can re-enable per-question required checks here if needed

    if (errors.length) {
      showToastNotification(errors[0], 'warning');
      return;
    }

    // 7) Update global snapshot so showFinishModal/other parts can read full merged answers
    window._todaytasks_answers = JSON.parse(JSON.stringify(mergedStructured || {}));

    // 8) Prepare payload and send
    const payload = {
      level: currentLevel,
      unit: currentUnit,
      username: currentUser,
      title,
      answers
    };

    // Show modal / spinner
    const updateModal = document.getElementById('updateModal');
    if (updateModal) updateModal.style.display = 'flex';
    startUpdateStatusText();

    fetch('/api/submit-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        // hide modal
        if (updateModal) updateModal.style.display = 'none';
        stopUpdateStatusText();

        if (!ok) throw new Error(data.error || 'Submission failed');

        const { incorrect_list = [], correct, total, percent } = data;
        const resultHTML = [];

        resultHTML.push(`<h2 style="margin-bottom: 16px;">Result: ${correct}/${total} correct (${Math.round(percent)}%)</h2>`);

        if (incorrect_list.length > 0) {
          resultHTML.push(`<p style="color: #ffc107;">You made mistakes in the following questions:</p>`);
          incorrect_list.forEach(item => {
            const q = questions.find(q =>
              q.id === item.q || (q.subquestions || []).some(sq => sq.id === item.q)
            );
            const sub = (q && (q.subquestions || []).find(sq => sq.id === item.q)) || q || { text: '' };

            resultHTML.push(`<div class="exam-subquestion" style="margin: 16px 0;">`);
            resultHTML.push(`<p class="question-text"><strong>${item.q}.</strong> ${sub.text || ''}</p>`);

            // multiple-choice / true-false
            if (sub && (sub.type === 'true_false' || (sub.type === 'multiple_choice' && Array.isArray(sub.options)))) {
              const options = sub.type === 'true_false' ? ['True', 'False'] : sub.options;
              resultHTML.push(`<div class="question-options">`);
              options.forEach((opt, i) => {
                const isUser = item.user === opt;
                const isCorrect = item.correct === opt;
                const isWrong = isUser && !isCorrect;
                const letter = String.fromCharCode(65 + i);

                resultHTML.push(`
                  <div class="option-group">
                    <input type="radio" disabled ${isUser ? 'checked' : ''}>
                    <label style="${isWrong ? 'background-color: #fdd;' : ''};">
                      <span class="option-letter">${letter}</span>
                      <span class="option-text">${opt}</span>
                      ${isWrong ? ' ❌' : ''}
                    </label>
                  </div>
                `);
              });
              resultHTML.push(`</div>`);
            }

            // box-choose
            else if (sub && sub.type === 'box-choose') {
              const isCorrect = item.user === item.correct;
              resultHTML.push(`<div class="box-choose-options">`);
              resultHTML.push(`
                <span class="box-choose-blank ${isCorrect ? 'correct' : 'incorrect'}">
                  ${item.user || '—'} ${!isCorrect ? '❌' : ''}
                </span>
                ${!isCorrect ? `<span class="box-choose-blank correct">${item.correct}</span>` : ''}
              `);
              resultHTML.push(`</div>`);
            }

            // unscramble
            else if (sub && sub.type === 'unscramble') {
              const userLetters = (item.user || '').split('');
              const correctLetters = (item.correct || '').split('');

              resultHTML.push(`<div class="unscramble-letters-review">`);
              userLetters.forEach((l, i) => {
                const correct = correctLetters[i] === l;
                resultHTML.push(`<span class="unscramble-letter ${correct ? 'correct' : 'incorrect'}">${l || '_'}</span>`);
              });
              resultHTML.push(`</div>`);

              resultHTML.push(`<p><strong>Correct:</strong> <span style="color:#4caf50">${item.correct}</span></p>`);
            }

            // select-options
            else if (sub && sub.type === 'select-options') {
              const isCorrect = item.user === item.correct;
              resultHTML.push(`<p><strong>Your Answer:</strong> <span style="${isCorrect ? 'color: #4caf50;' : 'color: #f44336;'}">${item.user || '—'}</span></p>`);
              if (!isCorrect) {
                resultHTML.push(`<p><strong>Correct Answer:</strong> <span style="color: #4caf50;">${item.correct}</span></p>`);
              }
            }

            // текст и другие
            else {
              resultHTML.push(`<p><strong>Your Answer:</strong> <span style="color: #f44336;">${item.user || '—'}</span></p>`);
              resultHTML.push(`<p><strong>Correct Answer:</strong> <span style="color: #4caf50;">${item.correct}</span></p>`);
            }

            resultHTML.push(`</div>`);
          });
        } else {
          resultHTML.push(`<p style="color: #4caf50;">🎉 Excellent! You answered all questions correctly.</p>`);
        }

        // replace content with result
        if (content) content.innerHTML = resultHTML.join('');

        // Play sounds: reward if >= 80, fail sound if < 79
        if (percent >= 80) {
          new Audio('/static/music/Coins_Rewarded.mp3').play().catch(console.log);
        } else if (percent < 79) {
          new Audio('/static/music/lagapet.ogg').play().catch(console.log);
        }

        // Remove rain and lightning
        document.querySelectorAll('.rain-drop, .lightning-flash, .lightning-drop').forEach(el => el.remove());

        // Add summer night scene
        const header = document.getElementById('todaytasks-header');
        if (header) header.classList.add('summer-scene');

        // add decorations (moon, tree, stars, fireflies)
        const moon = document.createElement('div'); moon.className = 'moon'; if (header) header.appendChild(moon);
        const tree = document.createElement('div'); tree.className = 'summer-tree'; if (header) header.appendChild(tree);
        for (let i = 0; i < 30; i++) {
          const star = document.createElement('div'); star.className = 'star';
          star.style.top = `${Math.random() * 60}%`; star.style.left = `${Math.random() * 100}%`;
          star.style.animationDelay = `${Math.random() * 4}s`; if (header) header.appendChild(star);
        }
        for (let i = 0; i < 8; i++) {
          const firefly = document.createElement('div'); firefly.className = 'firefly';
          firefly.style.top = `${60 + Math.random() * 40}%`; firefly.style.left = `${Math.random() * 100}%`;
          firefly.style.animationDelay = `${Math.random() * 5}s`; if (header) header.appendChild(firefly);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Buttons: hide finish, show done
        const finishBtn = document.getElementById('finish-tasks-btn');
        if (finishBtn) finishBtn.style.display = 'none';

        let doneBtn = document.getElementById('done-tasks-btn');
        if (!doneBtn) {
          doneBtn = document.createElement('button');
          doneBtn.id = 'done-tasks-btn';
          doneBtn.className = 'btn btn-success';
          doneBtn.style.padding = '0.5rem 1rem';
          doneBtn.style.fontSize = '1rem';
          doneBtn.textContent = 'Done';
          doneBtn.onclick = () => {
            showPage('today');
            if (content) content.innerHTML = '';
            doneBtn.style.display = 'none';
            const finishBtn2 = document.getElementById('finish-tasks-btn');
            if (finishBtn2) finishBtn2.style.display = 'inline-block';
          };
          const headerEl = document.getElementById('todaytasks-header');
          if (headerEl) headerEl.appendChild(doneBtn);
        } else {
          doneBtn.style.display = 'inline-block';
        }

      })
      .catch(err => {
        console.error(err);
        const updateModal = document.getElementById('updateModal');
        if (updateModal) updateModal.style.display = 'none';
        stopUpdateStatusText();
        showToastNotification(err.message, 'error');
      });

  } catch (errOuter) {
    console.error('finishTodayTasks error:', errOuter);
    stopUpdateStatusText();
    const updateModal = document.getElementById('updateModal');
    if (updateModal) updateModal.style.display = 'none';
    showToastNotification('An error occurred while finishing tasks.', 'error');
  }
}


function initCustomAudioPlayers() {
  document.querySelectorAll('.custom-audio-player').forEach(player => {
    const btn = player.querySelector('.custom-play-btn');
    const audio = player.closest('.listening-audio').querySelector('audio');
    const progressBar = player.querySelector('.custom-audio-waves');
    const progress = player.querySelector('.progress');
    const timeDisplay = player.querySelector('.custom-time-display');

    audio.dataset.audioPlayerId = Math.random().toString(36).slice(2);

    btn.onclick = () => {
      document.querySelectorAll('audio').forEach(other => {
        if (other !== audio) {
          other.pause();
          other.currentTime = 0;
        }
      });

      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    };

    // ✅ Click to seek logic
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const percent = offsetX / rect.width;
      if (!isNaN(audio.duration)) {
        audio.currentTime = percent * audio.duration;
      }
    });

    audio.addEventListener('play', () => {
      btn.innerHTML = '<i class="fas fa-pause"></i>';
    });

    audio.addEventListener('pause', () => {
      btn.innerHTML = '<i class="fas fa-play"></i>';
    });

    audio.addEventListener('ended', () => {
      btn.innerHTML = '<i class="fas fa-play"></i>';
    });

    audio.addEventListener('timeupdate', () => {
      if (!isNaN(audio.duration)) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = percent + '%';
        timeDisplay.textContent = formatTime(audio.currentTime);
      }
    });

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }
  });
}




// ✅ При выборе box-choose-option вставляется в blank и удаляется
function handleBoxChooseInteraction(blankId, optionValue) {
  const blank = document.getElementById(blankId);
  if (!blank) return;
  blank.textContent = optionValue;
  blank.dataset.value = optionValue;

  // Удаляем выбранную опцию (поиск по значению и удаление)
  const options = document.querySelectorAll('.box-choose-option');
  options.forEach(opt => {
    if (opt.textContent === optionValue) {
      opt.remove();
    }
  });
}



// Плейсхолдер, если заданий нет
function renderNoTasksPlaceholder(container) {
  const placeholder = document.createElement('div');
  placeholder.className = 'no-tasks-placeholder';
  placeholder.innerHTML = `
    <div class="no-tasks-icon">
      <img src="/static/icons/no-tasks.png" alt="No Tasks Icon">
    </div>
    <div class="no-tasks-text">Tasks not assigned today</div>
  `;
  container.appendChild(placeholder);
  updateTaskCount();
}

function toggleAccordion(header) {
  const accordion = header.parentElement;
  accordion.classList.toggle('open');
}

function fetchExamResults() {
  fetch('/api/get_exam_results')
    .then(res => res.json())
    .then(data => {
      // ожидаем структуру { correct: …, total_questions: …, correct_percentage: … }
      examResults = data;
      updateExamDisplay();
    })
    .catch(err => {
      console.error('Failed to fetch exam results:', err);
    });
}

// Клиент слушает событие, которое сервер отправит в ответ
socket.on('tempBanUser', (data) => {
  console.log("Received tempBanUser event:", data);
  blockUser(data.username, data.duration);
});

// Клиент слушает событие unblockUser
socket.on('unblockUser', (data) => {
   stopSpecialMusic();
  console.log("Received unblockUser event:", data);
  unblockUsername(data.username);
});

const blockStates = new Map(); // { username: { isBlocked, timerInterval, blockEndTime, clickHandler } }
const blockScreen = document.getElementById("block-screen");
const timerElement = document.getElementById("timer");

// Форматирование времени MM:SS
function formatTimeBlock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Таймер блокировки
function startBlockTimer(username, duration, userState, timerElement) {
  let timeLeft = duration;
  let intervalId = null;
  let musicTriggered = false;

  timerElement.textContent = "Click here to start timer";
  timerElement.style.cursor = 'pointer';
  timerElement.classList.add('pulse-timer');

  const handleClick = () => {
    if (musicTriggered) return;
    musicTriggered = true;

    playSpecialMusic();
    timerElement.textContent = formatTimeBlock(timeLeft);
    timerElement.classList.remove('pulse-timer');
    timerElement.style.cursor = 'default';

    intervalId = setInterval(() => {
      timeLeft--;
      timerElement.textContent = formatTimeBlock(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(intervalId);
        unblockUsername(username);
      }
    }, 1000);

    userState.timerInterval = intervalId;
  };

  // Удаляем старый обработчик, если был
  if (userState.clickHandler) {
    timerElement.removeEventListener('click', userState.clickHandler);
  }

  userState.clickHandler = handleClick;
  timerElement.addEventListener('click', handleClick);
}

// Блокировка пользователя
function blockUser(username, duration) {
  stopSpecialMusic();

  if (!Number.isInteger(duration) || duration <= 0) {
    console.log(`Invalid duration: ${duration}. Must be a positive integer.`);
    return;
  }

  const currentUser = getCurrentUser();
  if (username !== currentUser) return;

  let userState = blockStates.get(username) || {
    isBlocked: false,
    timerInterval: null,
    blockEndTime: null,
    clickHandler: null
  };

  // Очищаем старый таймер, если он был
  if (userState.timerInterval) {
    clearInterval(userState.timerInterval);
    userState.timerInterval = null;
  }

  // Показываем блокировку
  blockScreen.classList.remove('hidden');
  blockScreen.classList.add('visible');

  const warningText = `${username}, your recent actions have crossed the line! 
Such behavior is absolutely not allowed here. 
You are temporarily blocked to cool off. 
If this happens again, a permanent ban will follow — no second chances!`;

  const blockEndTime = Date.now() + duration * 1000;
  userState.isBlocked = true;
  userState.blockEndTime = blockEndTime;

  try {
    localStorage.setItem(`blockEndTime_${username}`, blockEndTime);
  } catch (err) {
    console.error(`Failed to save blockEndTime: ${err.message}`);
  }

  document.body.style.pointerEvents = 'none';

  speak(warningText, () => {
    startBlockTimer(username, duration, userState, timerElement);
    blockStates.set(username, userState); // Обновляем userState только после запуска таймера
  });
}

// Разблокировка
function unblockUsername(username) {
  const userState = blockStates.get(username);
  if (!userState || !userState.isBlocked) {
    console.log(`User ${username} is not blocked.`);
    return;
  }

  if (userState.timerInterval) {
    clearInterval(userState.timerInterval);
    userState.timerInterval = null;
  }

  document.body.style.pointerEvents = 'auto';
  blockScreen.classList.remove("visible");

  stopSpecialMusic();
  messageTimestamps = [];

  timerElement.textContent = '';
  if (userState.clickHandler) {
    timerElement.removeEventListener('click', userState.clickHandler);
    userState.clickHandler = null;
  }

  try {
    localStorage.removeItem(`blockEndTime_${username}`);
  } catch (err) {
    console.error(`Failed to remove blockEndTime: ${err.message}`);
  }

  userState.isBlocked = false;
  blockStates.delete(username);
}


document.addEventListener("DOMContentLoaded", () => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.log("No current user found on page load.");
    return;
  }

  const blockEndTimeKey = `blockEndTime_${currentUser}`;
  const blockEndTimeRaw = localStorage.getItem(blockEndTimeKey);

  if (blockEndTimeRaw) {
    const blockEndTime = parseInt(blockEndTimeRaw, 10);
    const now = Date.now();
    const remainingTime = Math.floor((blockEndTime - now) / 1000);

    if (remainingTime > 0) {
      console.log(`🔒 User is still blocked for ${remainingTime} seconds`);
      // Восстанавливаем блокировку без озвучки
      const userState = {
        isBlocked: true,
        timerInterval: null,
        blockEndTime: blockEndTime
      };

      blockScreen.classList.remove('hidden');
      blockScreen.classList.add('visible');

      document.body.style.pointerEvents = 'none';

      startBlockTimer(currentUser, remainingTime, userState, timerElement);
      blockStates.set(currentUser, userState);
    } else {
      // Время блокировки истекло
      localStorage.removeItem(blockEndTimeKey);
      blockStates.delete(currentUser);
      console.log("✅ Block expired. Cleaned up.");
    }
  }
});

async function fetchDebts() {
  const res = await fetch('/api/debts');
  const { incoming, outgoing } = await res.json();
  renderDebtList('incoming-debts', incoming, true);
  renderDebtList('outgoing-debts', outgoing, false);
}

function renderDebtList(containerId, debts, incoming) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  if (!debts.length) {
    const msg = document.createElement('div');
    msg.className = 'debt-empty';
    msg.textContent = incoming
      ? 'You have no incoming debt proposals.'
      : 'You have no outgoing debt proposals.';
    el.appendChild(msg);
    return;
  }
  debts.forEach(d => {
    const card = document.createElement('div');
    card.className = 'debt-card';
    card.innerHTML = `
      <div class="debt-info">
        <strong>${incoming ? d.proposer : d.proposee}</strong>
        <small>${new Date(d.due_date).toLocaleString()}</small>
        <span class="debt-status ${d.label}">${d.label}</span>
        <span>${d.amount} pts + ${d.interest}%</span>
        <span>Total due: ${d.total_due}</span>
      </div>
      <div class="debt-actions">
        ${incoming && d.status==='pending' ?
          `<button class="accept" onclick="actionDebt(${d.id}, 'accept')">Accept</button>
           <button class="decline" onclick="actionDebt(${d.id}, 'decline')">Decline</button>`
        : ''}
        ${incoming && d.status==='accepted' ?
          `<button class="repay" onclick="actionDebt(${d.id}, 'repay')">Repay</button>`
        : ''}
      </div>
    `;
    el.appendChild(card);
  });
}

async function actionDebt(id, act) {
  const res = await fetch(`/api/debts/${id}/${act}`, { method:'POST' });
  const json = await res.json();
  showToastNotification(json.status || json.error, res.ok ? 'success' : 'error');
  fetchDebts();
}

// Модалка
const newBtn = document.getElementById('new-debt-btn');
newBtn.onclick = () => document.getElementById('debt-modal').style.display = 'flex';
const cancelBtn = document.getElementById('debt-cancel');
cancelBtn.onclick = () => document.getElementById('debt-modal').style.display = 'none';
const submitBtn = document.getElementById('debt-submit');
submitBtn.onclick = async () => {
  const user = document.getElementById('debt-user').value;
  const amount = +document.getElementById('debt-amount').value;
  const interest = +document.getElementById('debt-interest').value;

  // Берём локальную дату и переводим её в UTC+5
  const localDue = new Date(document.getElementById('debt-due').value);
  const utcPlus5 = new Date(localDue.getTime() - (localDue.getTimezoneOffset() * 60000) - (5 * 60 * 60 * 1000));
  const utcDue = utcPlus5.toISOString();

  const payload = {
    username: user,
    amount: amount,
    interest: interest,
    due_date: utcDue
  };

  const res = await fetch('/api/debts/propose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const j = await res.json();
  showToastNotification(j.status || j.error || 'Unknown response', res.ok ? 'success' : 'error');
  document.getElementById('debt-modal').style.display = 'none';
  fetchDebts();
};

let audioContext;
let sourceNode = null;
let gainNode = null;
let isMusicPlaying = false;

const tracks = [
  '/static/music/season3.mp3'
];

let currentTrackIndex = 0;

// 🔁 Кэш загруженных аудио
const audioBufferCache = new Map();

// 🔁 Функция для загрузки и кэширования трека
async function loadAndCacheTrack(url) {
  if (audioBufferCache.has(url)) {
    return audioBufferCache.get(url); // ✅ уже загружен
  }

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();

  if (!audioContext) audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  audioBufferCache.set(url, audioBuffer); // 📦 кэшируем
  return audioBuffer;
}

// 🔁 Воспроизведение трека из кэша
async function playNextTrack() {
  stopSpecialMusic(); // ⛔ остановка предыдущего трека

  const trackUrl = tracks[currentTrackIndex];

  try {
    const audioBuffer = await loadAndCacheTrack(trackUrl);

    gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(gainNode).connect(audioContext.destination);

    sourceNode.start();
    isMusicPlaying = true;

    console.log(`🎵 Now playing: ${trackUrl}`);

    sourceNode.onended = () => {
      currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
      playNextTrack(); // 🔁 следующий
    };
  } catch (err) {
    console.error('❌ Failed to play track:', err);
  }
}

// ▶️ Запуск
function playSpecialMusic() {
  if (isMusicPlaying) return;
  if (!audioContext) audioContext = new AudioContext();
  playNextTrack();
}

// ⛔ Остановка
function stopSpecialMusic() {
  if (sourceNode) {
    try {
      sourceNode.onended = null;
      sourceNode.stop();
      sourceNode.disconnect();
    } catch (e) {
      console.warn("⚠️ Already stopped or error:", e);
    }
    sourceNode = null;
  }
  isMusicPlaying = false;
}






const animationCache = {}; // Кеш JSON-данных
let currentAnim = null;

async function showModalStatus(text, type = "success") {
  let modal = document.getElementById('statusModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'statusModal';
    modal.className = 'status-modal';
    modal.innerHTML = `
      <div class="status-modal-content">
        <div id="statusAnimation" class="lottie-animation"></div>
        <p id="statusText-modal" class="status-text-modal"></p>
        <p id="statusSubText" class="status-subtext"></p>
        <button id="statusOkBtn" class="status-modal-btn">OK</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const animationContainer = document.getElementById('statusAnimation');
  const statusText = document.getElementById('statusText-modal');
  const statusSubText = document.getElementById('statusSubText');

  let animationFile = "success.json";
  let subText = "Success";

  if (type === "failed") {
    animationFile = "failed.json";
    subText = "Failed";
  }

  statusText.textContent = text;
  statusSubText.textContent = subText;

  animationContainer.style.width = type === 'failed' ? '200px' : '140px';
  animationContainer.style.height = type === 'failed' ? '200px' : '140px';
  animationContainer.innerHTML = '';

  // Останавливаем текущую анимацию
  if (currentAnim) {
    currentAnim.destroy();
    currentAnim = null;
  }

  // Загружаем JSON только один раз
  let animationData = animationCache[animationFile];
  if (!animationData) {
    try {
      const response = await fetch(`/static/animations/${animationFile}`);
      animationData = await response.json();
      animationCache[animationFile] = animationData; // кешируем
    } catch (error) {
      console.error("Failed to load animation:", error);
      return;
    }
  }

  // Загружаем Lottie из кеша
  currentAnim = lottie.loadAnimation({
    container: animationContainer,
    renderer: 'svg',
    loop: false,
    autoplay: true,
    animationData: animationData
  });

  modal.style.display = 'flex';

  document.getElementById('statusOkBtn').onclick = () => {
    modal.style.display = 'none';
  };
}


// Отключение стандартного контекстного меню
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

// Показ меню при выделении текста
document.addEventListener('mouseup', function(e) {
    setTimeout(() => {
        const selection = window.getSelection();
        const menu = document.getElementById('customMenu');
        if (selection.toString().length > 0 && !selection.isCollapsed) {
            // Adjust position to prevent off-screen placement
            const { adjustedX, adjustedY } = adjustMenuPosition(e.pageX, e.pageY, menu);
            showCustomMenuAboveSelection(adjustedX, adjustedY);
        } else {
            hideCustomMenu();
        }
    }, 10);
});

// Показ кастомного меню над выделенным текстом
function showCustomMenuAboveSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const menu = document.getElementById('customMenu');

    // Сначала показать меню, чтобы корректно измерить размеры
    menu.style.display = 'block';
    menu.style.opacity = '0';

    // Получаем размеры меню
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;

    // Вычисляем координаты появления (по центру выделения, над ним)
    let x = rect.left + (rect.width / 2) - (menuWidth / 2);
    let y = rect.top - menuHeight - 8; // на 8px выше выделения

    // Учесть прокрутку страницы
    x += window.scrollX;
    y += window.scrollY;

    // Регулируем координаты, чтобы не выйти за границы
    const adjusted = adjustMenuPosition(x, y, menu);

    menu.style.left = adjusted.adjustedX + 'px';
    menu.style.top = adjusted.adjustedY + 'px';

    // Плавное появление
    setTimeout(() => {
        menu.style.opacity = '1';
    }, 10);
}

// Скрытие меню с анимацией
function hideCustomMenu() {
    const menu = document.getElementById('customMenu');
    if (menu.style.display !== 'block') return;
    menu.style.opacity = '0';
    setTimeout(() => {
        menu.style.display = 'none';
    }, 200);
}

// Коррекция позиции (не выходить за экран)
function adjustMenuPosition(x, y, menu) {
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuWidth > windowWidth - 10) {
        adjustedX = windowWidth - menuWidth - 10;
    }
    if (x < 10) {
        adjustedX = 10;
    }
    if (y + menuHeight > windowHeight - 10) {
        adjustedY = windowHeight - menuHeight - 10;
    }
    if (y < 10) {
        adjustedY = 10;
    }

    return { adjustedX, adjustedY };
}

// Закрытие меню при клике вне или отмене выделения
document.addEventListener('mousedown', function(e) {
    const menu = document.getElementById('customMenu');
    if (!menu.contains(e.target)) {
        hideCustomMenu();
    }
});

// Закрытие по Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        hideCustomMenu();
        window.getSelection().removeAllRanges();
    }
});

// Показываем меню при выделении текста (mouseup)
document.addEventListener('mouseup', function() {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
        showCustomMenuAboveSelection();
    } else {
        hideCustomMenu();
    }
});


    function searchText() {
        console.log('[DEBUG] searchText called');
        const selection = window.getSelection().toString();
        if (selection) {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(selection)}`;
            window.open(searchUrl, '_blank');
        }
    }

    async function copyText() {
        console.log('[DEBUG] copyText called');
        const selection = window.getSelection().toString();
        if (!selection) return;
        try {
            await navigator.clipboard.writeText(selection);
            console.log('Copied with Clipboard API');
        } catch (err) {
            console.warn('Fallback to execCommand…', err);
            const temp = document.createElement('textarea');
            temp.value = selection;
            temp.style.position = 'fixed';
            temp.style.opacity = '0';
            document.body.appendChild(temp);
            temp.select();
            try {
                document.execCommand('copy');
                console.log('Copied with execCommand');
            } catch (err2) {
                console.error('Copy failed:', err2);
            }
            document.body.removeChild(temp);
        }
    }

    async function pasteText() {
        console.log('[DEBUG] pasteText called');
        const active = document.activeElement;
        if (!active || !('value' in active)) return;
        try {
            const text = await navigator.clipboard.readText();
            const start = active.selectionStart;
            const end = active.selectionEnd;
            const before = active.value.slice(0, start);
            const after = active.value.slice(end);
            active.value = before + text + after;
            const pos = start + text.length;
            active.setSelectionRange(pos, pos);
            console.log('Text pasted');
        } catch (err) {
            console.error('Paste error:', err);
        }
    }
	
let updateStatusTimeout = null;
let index = 0;
let fallbackIndex = 0;
let inFallback = false;

const messages = [
  { text: "Javoblaringizni tahlil qilayapmiz", icon: "🧪" },
  { text: "Hozircha yaxshi ketyapsiz", icon: "🚀" },
  { text: "Hmm... qiziqarli natijalar chiqyapti", icon: "👀" },
  { text: "Har bir detalga e’tibor bermoqdamiz", icon: "🧐" },
  { text: "Yakuniy hisob-kitob ketmoqda", icon: "📊" },
  { text: "AI natijalarni yakunlamoqda", icon: "🤖" }
];

const fallbackMessages = [
  {
    text: "Bir oz dam oldik, lekin gaz beramiz!",
    icon: "🔧"
  },
  {
    text: "Voy, negadur tizim sekinlashdi... bu vaqti-vaqti bilan bo‘lib turadi. Iltimos, sabrli bo‘ling!",
    icon: "🐢"
  },
  {
    text: "Sekinlashganimiz rost, ammo to‘xtamadik! Hamma narsa nazoratda ",
    icon: "🛠️"
  }
];


const statusText = document.getElementById("statusText");

function updateStatusText() {
  if (!statusText) return;

  statusText.classList.remove("slide-in");
  statusText.classList.add("slide-out");

  setTimeout(() => {
    let currentMessage;

    if (inFallback) {
      fallbackIndex = (fallbackIndex + 1) % fallbackMessages.length;
      currentMessage = fallbackMessages[fallbackIndex];
      statusText.classList.add("status-fallback");
    } else {
      index++;

      if (index >= messages.length) {
        // Переход в fallback режим
        inFallback = true;
        fallbackIndex = 0;
        currentMessage = fallbackMessages[fallbackIndex];
        statusText.classList.add("status-fallback");
      } else {
        currentMessage = messages[index];
      }
    }

    // Обновление текста и иконки
    statusText.innerHTML = `
      <span class="status-text-inner">${currentMessage.text}</span>
      <span class="status-icon">${currentMessage.icon}</span>
    `;

    statusText.classList.remove("slide-out");
    void statusText.offsetWidth; // Force reflow
    statusText.classList.add("slide-in");

    const delay = inFallback || index >= messages.length - 2 ? 5000 : 2000;
    updateStatusTimeout = setTimeout(updateStatusText, delay);
  }, 400);
}

function startUpdateStatusText() {
  if (!statusText) return;

  // Сброс состояний
  clearTimeout(updateStatusTimeout);
  index = 0;
  fallbackIndex = 0;
  inFallback = false;
  statusText.classList.remove("status-fallback");

  const firstMessage = messages[index];
  statusText.innerHTML = `
    <span class="status-text-inner">${firstMessage.text}</span>
    <span class="status-icon">${firstMessage.icon}</span>
  `;
  statusText.classList.add("slide-in");

  updateStatusTimeout = setTimeout(updateStatusText, 2000);
}

function stopUpdateStatusText() {
  clearTimeout(updateStatusTimeout);
  updateStatusTimeout = null;
  index = 0;
  fallbackIndex = 0;
  inFallback = false;

  if (statusText) {
    statusText.classList.remove("status-fallback");
  }
}

  async function submitTransfer() {
    const sender = currentUser;
    const receiver = document.getElementById("receiver").value.trim();
    const amount = parseFloat(document.getElementById("amount").value);

    if (!receiver || isNaN(amount) || amount <= 0) {
      showModalStatus("Please enter a valid receiver and a positive amount.", "failed");
      return;
    }

    try {
      const response = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender, receiver, amount })
      });

      const result = await response.json();

      if (response.ok) {
        showModalStatus(` ${amount} points sent to ${receiver}`, "success");
        document.getElementById("receiver").value = "";
        document.getElementById("amount").value = "";
      } else {
        showModalStatus(` ${result.error || "Something went wrong."}`, "failed");
      }
    } catch (err) {
      showModalStatus("Network error. Please try again later.", "failed");
    }
  }
  
const carouselItems = document.querySelectorAll('.carousel-item');
let currentIndex = 0;
const totalItems = carouselItems.length;

function showNextItem() {
  const current = carouselItems[currentIndex];
  const nextIndex = (currentIndex + 1) % totalItems;
  const next = carouselItems[nextIndex];

  current.classList.add('exiting');
  next.classList.add('active');

  setTimeout(() => {
    current.classList.remove('active', 'exiting');
    currentIndex = nextIndex;
  }, 600); // Совпадает с CSS transition
}

setInterval(showNextItem, 3000);
carouselItems[currentIndex].classList.add('active');

const carousel = document.querySelector('.carousel');
let startX = 0;
let endX = 0;

carousel.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
});

carousel.addEventListener('touchmove', (e) => {
  endX = e.touches[0].clientX;
});

carousel.addEventListener('touchend', () => {
  const deltaX = endX - startX;

  if (Math.abs(deltaX) > 50) {
    if (deltaX < 0) {
      showNextItem(); // свайп влево
    } else {
      showPrevItem(); // свайп вправо
    }
  }

  // сброс координат
  startX = 0;
  endX = 0;
});

function showPrevItem() {
  const current = carouselItems[currentIndex];
  const prevIndex = (currentIndex - 1 + totalItems) % totalItems;
  const prev = carouselItems[prevIndex];

  current.classList.add('exiting');
  prev.classList.add('active');

  setTimeout(() => {
    current.classList.remove('active', 'exiting');
    currentIndex = prevIndex;
  }, 600);
}

/*
Event
*/

function initExamSecurity(enable = true) {

    if (enable) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('mouseenter', handleMouseEnter);
        document.addEventListener('copy', onCopy);
        document.addEventListener('contextmenu', onContextMenu);
    } else {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('mouseenter', handleMouseEnter);
        document.removeEventListener('copy', onCopy);
        document.removeEventListener('contextmenu', onContextMenu);
    }
}

function speak(text, onEnd = null) {
  if (!window.speechSynthesis) {
    console.warn("Speech synthesis not supported.");
    if (onEnd) onEnd(); // fallback
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US"; // или "uz-UZ", "ru-RU"
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  if (typeof onEnd === 'function') {
    utterance.onend = onEnd;
  }

  window.speechSynthesis.cancel(); // остановить другие фразы
  window.speechSynthesis.speak(utterance);
}



function handleVisibilityChange() {
    if (document.hidden) {
        showToastNotification("Tab hidden",'info');
    }
}

function handleWindowBlur() {
    // может быть вызван при сворачивании окна
    setTimeout(() => {
        if (!document.hasFocus()) {
            incrementViolation("Window lost focus");
        }
    }, 200);
}

function handleWindowFocus() {
    // Можно использовать для сброса каких-то флагов
}

function handleMouseLeave(event) {
    if (event.clientY <= 0) {
        incrementViolation("Mouse left window (possibly tab switch)");
    }
}

function handleMouseEnter(event) {
    // optional: log return
}

function onCopy(event) {
    event.preventDefault();
    incrementViolation("Copy attempt");
}

function onPaste(event) {
    event.preventDefault();
    incrementViolation("Paste attempt");
}

function onContextMenu(event) {
    event.preventDefault();
    incrementViolation("Right-click attempt");
}

let violationCount = 0;
let maxViolations = 3;

function incrementViolation(reason = "Violation") {
  let warningText = "";

  if (violationCount === 0) {
    warningText = `${username}, this is a gentle reminder: please follow the community rules.
Let's keep things respectful.`;
  } else if (violationCount === 1) {
  warningText = `${username}, this is your second warning.
You've broken the rules again. Please correct your behavior or you may be blocked next time.`;
}
else if (violationCount === 2) {
    warningText = `${username}, this is your final warning.
One more violation and you're out — permanently. Make the right choice.`;
  }

  // Воспроизведение голосового предупреждения и последующая музыка
  speak(warningText, () => {
    // тут можно запустить музыку, если нужно
  });

  violationCount++;
  showToastNotification(`${reason}: ${violationCount}/${maxViolations}`, 'info');

  if (violationCount >= maxViolations) {
    blockUser(currentUser, 180); // временная блокировка на 15 минут
    violationCount = 0; // сброс счётчика
  }
}


document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active', 'animate__animated', 'animate__fadeIn'));
    const sectionId = item.getAttribute('data-section');
    if (sectionId) {
      const section = document.getElementById(sectionId);
      section.classList.add('active', 'animate__animated', 'animate__fadeIn');
    }
  });
});

function openPasswordModal() {
  document.getElementById('change-passwords-modal').classList.add('active');
}

function closePasswordModal() {
  document.getElementById('change-passwords-modal').classList.remove('active');
  document.getElementById('change-password-form').reset();
  document.getElementById('password-message').textContent = '';
  resetPasswordRequirements();
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const icon = input.nextElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function checkPasswordStrength() {
  const password = document.getElementById('newPassword').value;
  const strengthBar = document.getElementById('strength-bar');
  const strengthText = document.getElementById('strength-text');
  let strengthScore = 0;

  // Check requirements
  document.getElementById('lowercase').children[0].className = password.match(/[a-z]/) ? 'fas fa-check text-green' : 'fas fa-times text-red';
  document.getElementById('uppercase').children[0].className = password.match(/[A-Z]/) ? 'fas fa-check text-green' : 'fas fa-times text-red';
  document.getElementById('number').children[0].className = password.match(/[0-9]/) ? 'fas fa-check text-green' : 'fas fa-times text-red';
  document.getElementById('special').children[0].className = password.match(/[^A-Za-z0-9]/) ? 'fas fa-check text-green' : 'fas fa-times text-red';
  document.getElementById('length').children[0].className = password.length >= 8 ? 'fas fa-check text-green' : 'fas fa-times text-red';

  // Calculate strength
  if (password.match(/[a-z]/)) strengthScore++;
  if (password.match(/[A-Z]/)) strengthScore++;
  if (password.match(/[0-9]/)) strengthScore++;
  if (password.match(/[^A-Za-z0-9]/)) strengthScore++;
  if (password.length >= 8) strengthScore++;

  // Update strength bar and text
  strengthBar.className = 'strength-bar';
  if (strengthScore <= 2) {
    strengthBar.classList.add('weak');
    strengthText.textContent = 'Weak';
  } else if (strengthScore <= 4) {
    strengthBar.classList.add('medium');
    strengthText.textContent = 'Medium';
  } else {
    strengthBar.classList.add('strong');
    strengthText.textContent = 'Strong';
  }
}

function resetPasswordRequirements() {
  const requirements = ['lowercase', 'uppercase', 'number', 'special', 'length'];
  requirements.forEach(id => {
    document.getElementById(id).children[0].className = 'fas fa-times text-red';
  });
  document.getElementById('strength-bar').className = 'strength-bar';
  document.getElementById('strength-text').textContent = '';
}

document.getElementById('change-password-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const messageEl = document.getElementById('password-message');

  if (newPassword !== confirmPassword) {
    messageEl.style.color = 'var(--danger)';
    messageEl.textContent = 'Passwords do not match.';
    showModalStatus('Passwords do not match.', 'failed');
    return;
  }

  try {
    const res = await fetch('/change_password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await res.json();

    if (res.ok) {
      messageEl.style.color = 'var(--success)';
      messageEl.textContent = data.message;
      showModalStatus(data.message, 'success');
      setTimeout(closePasswordModal, 2000);
    } else {
      messageEl.style.color = 'var(--danger)';
      showModalStatus(data.error, 'failed');
      messageEl.textContent = data.error;
    }
  } catch (error) {
    messageEl.style.color = 'var(--danger)';
    showModalStatus('An error occurred. Please try again.', 'failed');
    messageEl.textContent = 'An error occurred. Please try again.';
  }
});

document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    document.getElementById(this.dataset.section).classList.add('active');
  });
});

  let riskLadderLevel = 0;
    let potentialReward = 0;

    const ladderLevelEl = document.getElementById("ladderLevel");
    const ladderRewardEl = document.getElementById("ladderReward");
    const ladderMessageEl = document.getElementById("ladderMessage");
    const progressFill = document.getElementById("progressFill");
    const particlesEl = document.getElementById("particles");

    const startBtn = document.getElementById("startLadderBtn");
    const nextBtn = document.getElementById("nextLadderBtn");
    const takeBtn = document.getElementById("takeRewardBtn");

    // Sound effects
    const winSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-retro-game-over-213.mp3');
    const loseSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-explosion-2759.mp3');
    const startSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-jump-229.mp3');

    // Update UI
    function updateLadderUI() {
      ladderLevelEl.textContent = riskLadderLevel;
      ladderRewardEl.textContent = potentialReward > 0 ? potentialReward + " pts" : "?";
      progressFill.style.width = `${(riskLadderLevel / 7) * 100}%`;
    }

    // Show message with animation
    function showMessage(msg, success = true) {
      ladderMessageEl.textContent = msg;
      ladderMessageEl.style.color = success ? "#90ee90" : "#ff6666";
      ladderMessageEl.style.animation = "fadeIn 0.5s ease";
      setTimeout(() => ladderMessageEl.style.animation = "", 500);
      createParticles(success);
      if (success) winSound.play();
      else loseSound.play();
    }

    // Create particle effects
    function createParticles(success) {
      for (let i = 0; i < 20; i++) {
        const particle = document.createElement("div");
        particle.className = "particle";
        particle.style.width = `${Math.random() * 5 + 3}px`;
        particle.style.height = particle.style.width;
        particle.style.background = success ? "#ffd700" : "#ff6666";
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.setProperty('--x', `${(Math.random() - 0.5) * 200}px`);
        particle.style.setProperty('--y', `${(Math.random() - 0.5) * 200}px`);
        particlesEl.appendChild(particle);
        setTimeout(() => particle.remove(), 1000);
      }
    }

    // Start ladder
    startBtn.addEventListener("click", () => {
      startSound.play();
      fetch('/api/risk_ladder', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, level: 1 })
      })
      .then(res => res.json())
      .then(data => {
        if (data.result === "success") {
          riskLadderLevel = data.level;
          potentialReward = data.reward;
          updateLadderUI();
          showMessage(data.message);
          startBtn.style.display = "none";
          nextBtn.style.display = "inline-block";
          takeBtn.style.display = "inline-block";
        } else {
          showMessage(data.message, false);
        }
      })
      .catch(err => showMessage("Error: Cosmic interference detected!", false));
    });

    // Next level
    nextBtn.addEventListener("click", () => {
      startSound.play();
      fetch('/api/risk_ladder', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, level: riskLadderLevel + 1 })
      })
      .then(res => res.json())
      .then(data => {
        if (data.result === "success") {
          riskLadderLevel = data.level;
          potentialReward = data.reward;
          updateLadderUI();
          showMessage(data.message);
          if (riskLadderLevel === 7) {
            nextBtn.style.display = "none";
          }
        } else {
          riskLadderLevel = 0;
          potentialReward = 0;
          updateLadderUI();
          showMessage(data.message, false);
          startBtn.style.display = "inline-block";
          nextBtn.style.display = "none";
          takeBtn.style.display = "none";
        }
      })
      .catch(err => showMessage("Error: Cosmic interference detected!", false));
    });

    // Claim reward
    takeBtn.addEventListener("click", () => {
      if (potentialReward > 0) {
        winSound.play();
        fetch('/api/risk_ladder_take', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ username, reward: potentialReward })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showMessage(`🎉 Cosmic Treasure Claimed: ${potentialReward} pts`);
          } else {
            showMessage("Error: Treasure lost in the void!", false);
          }
          riskLadderLevel = 0;
          potentialReward = 0;
          updateLadderUI();
          startBtn.style.display = "inline-block";
          nextBtn.style.display = "none";
          takeBtn.style.display = "none";
        })
        .catch(err => showMessage("Error: Cosmic interference during claim!", false));
      }
    });

    updateLadderUI();
	
	let horrorLevel = 0;
let horrorReward = 0;

const horrorLevelEl = document.getElementById("horrorLevel");
const horrorRewardEl = document.getElementById("horrorReward");
const horrorMessageEl = document.getElementById("horrorMessage");
const horrorProgressFill = document.getElementById("horrorProgressFill");
const horrorParticles = document.getElementById("horrorParticles");

const horrorStartBtn = document.getElementById("horrorStartBtn");
const horrorNextBtn = document.getElementById("horrorNextBtn");
const horrorClaimBtn = document.getElementById("horrorClaimBtn");

const horrorWinSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-retro-game-over-213.mp3');
const horrorLoseSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-explosion-2759.mp3');
const horrorStartSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-jump-229.mp3');

// 🩸 Начать Horror Games
horrorStartBtn.addEventListener("click", () => {
  horrorStartSound.play();
  fetch("/api/horror_event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: currentUser, level: 1 })
  })
    .then(res => res.json())
    .then(data => {
      if (data.result === "survived") {
        horrorLevel = data.level;
        horrorReward = data.reward;
        updateHorrorUI(data.message);
        updateHorrorProgress();
        toggleHorrorButtons();
        playParticles(true);
      } else {
        updateHorrorUI(data.error || data.message);
        playParticles(false);
      }
    });
});

// ☠️ Следующий уровень
horrorNextBtn.addEventListener("click", () => {
  horrorStartSound.play();
  fetch("/api/horror_event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: currentUser, level: horrorLevel + 1 })
  })
    .then(res => res.json())
    .then(data => {
      if (data.result === "survived") {
        horrorLevel = data.level;
        horrorReward = data.reward;
        updateHorrorUI(data.message);
        updateHorrorProgress();
        toggleHorrorButtons();
        playParticles(true);
      } else if (data.result === "screamer") {
        horrorLevel = 0;
        horrorReward = 0;
        updateHorrorProgress();
        toggleHorrorButtons(true);
        updateHorrorUI(data.message);
        triggerScreamerEffect();
        playParticles(false);
      } else {
        updateHorrorUI(data.error || "Something went wrong...");
      }
    });
});

// 🎁 Забрать награду
horrorClaimBtn.addEventListener("click", () => {
  fetch("/api/horror_event_take", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: currentUser, reward: horrorReward })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        updateHorrorUI(`🎁 You escaped with ${horrorReward} pts!`);
        horrorLevel = 0;
        horrorReward = 0;
        updateHorrorProgress();
        toggleHorrorButtons(true);
        horrorWinSound.play();
      } else {
        updateHorrorUI(data.error || "Couldn't claim reward.");
      }
    });
});

// 👁‍🗨 UI и анимации
function updateHorrorUI(message) {
  horrorLevelEl.textContent = horrorLevel || 0;
  horrorRewardEl.textContent = horrorReward || "?";
  horrorMessageEl.textContent = message || "";
}

function updateHorrorProgress() {
  const percent = (horrorLevel / 5) * 100;
  horrorProgressFill.style.width = percent + "%";
}

function toggleHorrorButtons(reset = false) {
  if (reset || horrorLevel === 0) {
    horrorStartBtn.style.display = "inline-block";
    horrorNextBtn.style.display = "none";
    horrorClaimBtn.style.display = "none";
  } else if (horrorLevel < 5) {
    horrorStartBtn.style.display = "none";
    horrorNextBtn.style.display = "inline-block";
    horrorClaimBtn.style.display = "inline-block";
  } else {
    horrorStartBtn.style.display = "none";
    horrorNextBtn.style.display = "none";
    horrorClaimBtn.style.display = "inline-block";
  }
}

function triggerScreamerEffect() {
  const mediaList = [
    "/static/horror/1.jpg"
  ];
  const media = mediaList[Math.floor(Math.random() * mediaList.length)];

  const overlay = document.getElementById("screamerOverlay");
  overlay.innerHTML = ""; // Очищаем прошлый контент

  let element;

  // Отдельно проигрываем скример-звук (всегда)
  const screamAudio = new Audio('/static/horror/screamer-sound.mp3');
  screamAudio.play();

  if (media.endsWith(".mp4") || media.endsWith(".webm")) {
    element = document.createElement("video");
    element.src = media;
    element.autoplay = true;
    element.playsInline = true;
    element.muted = false; // можно сделать true, если autoplay блокируется
    element.onended = () => overlay.style.display = "none";
    element.style.maxHeight = "100%";
    element.style.maxWidth = "100%";
  } else {
    element = document.createElement("img");
    element.src = media;
    setTimeout(() => {
      overlay.style.display = "none";
    }, 3000); // Фото показываем 3 сек
  }

  overlay.appendChild(element);
  overlay.style.display = "flex";
}



function playParticles(success = true) {
  if (!horrorParticles) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = `${Math.random() * 4 + 2}px`;
    p.style.width = size;
    p.style.height = size;
    p.style.background = success ? "#66ff66" : "#ff3333";
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${Math.random() * 100}%`;
    p.style.setProperty("--x", `${(Math.random() - 0.5) * 200}px`);
    p.style.setProperty("--y", `${(Math.random() - 0.5) * 200}px`);
    horrorParticles.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}
function fetchSessions() {
  fetch('/api/sessions/')
    .then(res => res.json())
    .then(data => {
      const sessionsList = document.getElementById('sessions-list');
      sessionsList.innerHTML = '';

      if (!data.sessions.length) {
        sessionsList.innerHTML = '<p>No active sessions found.</p>';
        return;
      }

      data.sessions.forEach(session => {
        const div = document.createElement('div');
        div.className = 'session-card';

        const isCurrent = session.isCurrent;
        const isNew = session.isNew;

        const currentBadge = isCurrent ? `<span class="badge badge-current">Current Session</span>` : '';
        const newBadge = isNew ? `<span class="badge badge-new">NEW</span>` : '';
        const country = session.country && session.country !== 'Unknown' ? ` (${session.country})` : '';
        const loginTime = session.loginTime || 'Unknown';
        const deviceName = `${session.deviceBrand || 'Device'} - ${session.deviceModel || session.deviceType}`;

        const terminateButton = document.createElement('button');
        terminateButton.className = 'terminate-btn' + (isCurrent ? ' disabled' : '');
        terminateButton.innerHTML = `<i class="fas fa-times-circle"></i> Terminate`;

        if (isCurrent) {
          terminateButton.disabled = true;
          terminateButton.title = "Cannot terminate current session";
        } else {
          terminateButton.onclick = () => terminateSession(session.sessionId);
        }

        div.innerHTML = `
          <h4>${deviceName} ${currentBadge} ${newBadge}</h4>
          <div class="info">OS: ${session.os}</div>
          <div class="info">Browser: ${session.browser}</div>
          <div class="info">IP: ${session.ipAddress}${country}</div>
          <div class="info">Language: ${session.language}</div>
          <div class="info">Login Time: ${loginTime}</div>
        `;

        div.appendChild(terminateButton);
        sessionsList.appendChild(div);
      });
    })
    .catch(err => {
      console.error("Failed to fetch sessions:", err);
      document.getElementById('sessions-list').innerHTML = '<p>Error loading sessions.</p>';
    });
}


let pendingSessionId = null;

function terminateSession(sessionId) {
  // Сохраняем сессию, которую надо удалить, в ожидании пароля
  pendingSessionId = sessionId;

  // Показываем модалку
  document.getElementById("confirmTerminateModal").style.display = "flex";
}

document.getElementById("cancelTerminateBtn").onclick = () => {
  pendingSessionId = null;
  document.getElementById("terminatePasswordInput").value = '';
  document.getElementById("confirmTerminateModal").style.display = "none";
};

document.getElementById("confirmTerminateBtn").onclick = () => {
  const password = document.getElementById("terminatePasswordInput").value.trim();
  if (!password || !pendingSessionId) return;

  // Проверяем пароль
  fetch('/api/verify-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  .then(res => res.json().then(data => ({ status: res.status, body: data })))
  .then(({ status, body }) => {
    if (status === 200) {
      // Успешная проверка — теперь удаляем сессию
      fetch(`/api/terminate-session/${pendingSessionId}`, {
        method: 'DELETE'
      })
      .then(res => res.json().then(data => ({ status: res.status, body: data })))
      .then(({ status, body }) => {
        if (status === 200) {
          showModalStatus("Session terminated successfully.");
          fetchSessions();
        } else {
          showModalStatus(body.error || "Failed to terminate session.", "failed");
        }
      });
    } else {
      showModalStatus(body.error || "Incorrect password", "failed");
    }
  })
  .catch(err => {
    console.error(err);
    showModalStatus("Server error.", "failed");
  })
  .finally(() => {
    document.getElementById("terminatePasswordInput").value = '';
    document.getElementById("confirmTerminateModal").style.display = "none";
    pendingSessionId = null;
  });
};



socket.on('updated-sessions', (data) => {
  console.log('[Socket] updated-sessions received for', data.username);

  // Отправим текущий User-Agent на сервер для проверки
  fetch('/api/check-session', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      userAgent: navigator.userAgent
    })
  })
  .then(res => res.json())
  .then(data => {
    if (!data.active) {
      // ⚠️ Нет активной сессии → авто-логаут
      showToastNotification("You have been logged out because your session was terminated.",'info');
      window.location.href = '/login';
    }
  });
});

let storiesItemsStories = [];
let currentIndexStories = 0;
let timeoutHandleStories = null;
let isPausedStories = false;
let holdTimeoutStories = null;

function fetchStoriesStories() {
  fetch('/api/stories')
    .then(r => r.json())
    .then(data => {
      storiesItemsStories = data.filter(s => s.mediaUrl || s.imageUrl);
      const list = document.getElementById('storiesList');
      list.innerHTML = '';
      storiesItemsStories.forEach((story, idx) => {
        const div = document.createElement('div');
        div.className = 'story-item';
        div.innerHTML = `
          <img src="${story.thumbnail || story.imageUrl}" alt="" />
          <div class="story-title">${story.title}</div>
        `;
        div.addEventListener('click', () => openStoryStories(idx));
        list.append(div);
      });
    });
}

function openStoryStories(idx) {
  const story = storiesItemsStories[idx];
  if (!story) return;
  currentIndexStories = idx;
  clearTimeout(timeoutHandleStories);

  const content = document.getElementById('storyContent');
  content.innerHTML = `
    <button class="close-btn" onclick="closeStoriesStories()">×</button>
    <div class="progress-container-stories">
      ${storiesItemsStories.map((_, i) => `<div class="progress-bar-stories" id="barStories${i}"></div>`).join('')}
    </div>
  `;

  let mediaElement;

  if (story.mediaType === 'video' || (story.videoUrl && story.videoUrl.endsWith('.mp4'))) {
    mediaElement = document.createElement('video');
    mediaElement.src = story.videoUrl || story.mediaUrl;
    mediaElement.autoplay = true;
    mediaElement.playsInline = true;
    mediaElement.onloadedmetadata = () => startProgressStories(mediaElement.duration * 1000);
    mediaElement.onended = nextStoryStories;
  } else {
    mediaElement = document.createElement('img');
    mediaElement.src = story.mediaUrl || story.imageUrl;
    startProgressStories(7000);
  }

  addStoryInteractions(mediaElement);
  content.append(mediaElement);

  document.getElementById('storyModal').style.display = 'flex';
}

function startProgressStories(duration) {
  storiesItemsStories.forEach((_, i) => {
    const b = document.getElementById(`barStories${i}`);
    if (b) {
      b.style.transition = 'none';
      b.style.transform = i < currentIndexStories ? 'scaleX(1)' : 'scaleX(0)';
    }
  });

  const bar = document.getElementById(`barStories${currentIndexStories}`);
  if (!bar) return;

  setTimeout(() => {
    bar.style.transition = `transform ${duration}ms linear`;
    bar.style.transform = 'scaleX(1)';
  }, 50);

  timeoutHandleStories = setTimeout(nextStoryStories, duration);
}

function pauseStory() {
  clearTimeout(timeoutHandleStories);
  isPausedStories = true;

  const video = document.querySelector('#storyContent video');
  if (video) video.pause();

  const bar = document.getElementById(`barStories${currentIndexStories}`);
  if (bar) {
    const computed = window.getComputedStyle(bar);
    const matrix = new WebKitCSSMatrix(computed.transform);
    const scale = matrix.a;
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${scale})`;
  }
}

function resumeStory() {
  if (!isPausedStories) return;
  isPausedStories = false;

  const video = document.querySelector('#storyContent video');
  if (video) {
    const remaining = (1 - video.currentTime / video.duration) * 1000 * video.duration;
    video.play();
    startProgressStories(remaining);
  } else {
    startProgressStories(3000); // assume 3s left on hold
  }
}

function addStoryInteractions(el) {
  if (!el) return;

  el.addEventListener('mousedown', () => {
    holdTimeoutStories = setTimeout(pauseStory, 200);
  });

  el.addEventListener('mouseup', () => {
    clearTimeout(holdTimeoutStories);
    resumeStory();
  });

  el.addEventListener('touchstart', () => {
    holdTimeoutStories = setTimeout(pauseStory, 200);
  });

  el.addEventListener('touchend', () => {
    clearTimeout(holdTimeoutStories);
    resumeStory();
  });

  el.addEventListener('dblclick', () => {
    nextStoryStories();
  });
}

function nextStoryStories() {
  clearTimeout(timeoutHandleStories);
  if (currentIndexStories + 1 < storiesItemsStories.length) {
    openStoryStories(currentIndexStories + 1);
  } else {
    closeStoriesStories();
  }
}

function closeStoriesStories() {
  clearTimeout(timeoutHandleStories);
  document.getElementById('storyModal').style.display = 'none';
  document.getElementById('storyContent').innerHTML = '';
}

document.addEventListener('DOMContentLoaded', fetchStoriesStories);


async function examsPageActive() {
  const container = document.getElementById("exams-container");
  container.innerHTML = `
    <div class="container-exam-loading">
      <div class="loader">
        <div class="crystal"></div>
        <div class="crystal"></div>
        <div class="crystal"></div>
        <div class="crystal"></div>
        <div class="crystal"></div>
        <div class="crystal"></div>
      </div>
    </div>
  `;

  const username = currentUser;
  try {
    const res = await fetch(`/api/get-student-progress?username=${username}`);
    const data = await res.json();

    if (data.error || !data[username]) {
      container.innerHTML = '<p class="error-msg">No data found.</p>';
      return;
    }

    const student = data[username];
    const level = window.currentLevel || "Beginner";
    const studyDays = student["study_days"] || "-";
    const midterm = student["midterm-exam"] || "Not Assigned";
    const final = student["final-exam"] || "Not Assigned";

    container.innerHTML = `
      <div class="exam-card" style="animation-delay: 0s;">
        <div class="exam-icon" style="background: linear-gradient(135deg, #007bff, #0056b3);">
          <i class="fas fa-file-alt"></i>
        </div>
        <div class="exam-info">
          <h3>Midterm Exam</h3>
          <p><strong>Group:</strong> ${level} (${studyDays})</p>
          <p><strong>Date:</strong> ${midterm}</p>
        </div>
      </div>
      <div class="exam-card" style="animation-delay: 0.15s;">
        <div class="exam-icon" style="background: linear-gradient(135deg, #dc3545, #a71d2a);">
          <i class="fas fa-graduation-cap"></i>
        </div>
        <div class="exam-info">
          <h3>Final Exam</h3>
          <p><strong>Group:</strong> ${level} (${studyDays})</p>
          <p><strong>Date:</strong> ${final}</p>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="error-msg">Server error. Try again later.</p>';
  }
}

const ideaList = document.getElementById('idea-list');
const ideaForm = document.getElementById('idea-form');
const toggleButton = document.getElementById('toggle-idea-form');
const overlay = document.getElementById('idea-overlay');
const fileInputIdeas = document.querySelector('input[name="media"]');
const submitButton = ideaForm.querySelector('button[type="submit"]');

// Показываем форму
toggleButton.onclick = () => {
  hideNavigation();
  ideaForm.classList.add('show');
  ideaForm.classList.remove('hidden');
  overlay.classList.remove('hidden');
};

// Скрываем форму
overlay.onclick = () => {
  showNavigation();
  ideaForm.classList.remove('show');
  ideaForm.classList.add('hidden');
  overlay.classList.add('hidden');
};

// Загрузка идей при входе
async function loadIdeas() {
  const res = await fetch(`/get_ideas/${currentUser}`);
  const ideas = await res.json();

  ideaList.innerHTML = '';
  ideas.reverse().forEach((idea, index) => {
    const card = document.createElement('div');
    card.className = 'idea-card';

    const date = new Date(idea.timestamp);
    const formatted = date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });

    card.innerHTML = `
      <div class="idea-header">
        <div class="idea-title">Submission #${index + 1}</div>
        <span class="idea-status ${idea.status.toLowerCase().replace(' ', '-')}"">${idea.status}</span>
      </div>
      <div class="idea-text">${idea.text}</div>
      ${idea.media ? '<div class="idea-media">Attached file</div>' : ''}
      <div class="idea-footer">
        <i class="far fa-calendar-alt"></i>
        <span>${formatted}</span>
      </div>
    `;
    ideaList.appendChild(card);
  });
}

// Отправка формы
ideaForm.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(ideaForm);
  formData.append('username', currentUser);

  const loader = document.createElement('div');
  loader.className = 'container-exam-loading';
  const innerLoader = document.createElement('div');
  innerLoader.className = 'loader';
  for (let i = 0; i < 6; i++) {
    const crystal = document.createElement('div');
    crystal.className = 'crystal';
    innerLoader.appendChild(crystal);
  }
  const progress = document.createElement('span');
  progress.className = 'upload-progress';
  progress.textContent = '0%';
  loader.appendChild(innerLoader);
  loader.appendChild(progress);
  loader.style.display = 'flex';
  loader.style.flexDirection = 'column';
  loader.style.alignItems = 'center';
  loader.style.marginLeft = '10px';
  fileInputIdeas.parentNode.appendChild(loader);

  submitButton.disabled = true;
  submitButton.style.pointerEvents = 'none';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/submit_idea', true);
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progress.textContent = `${percent}%`;
    }
  };
  xhr.onload = () => {
    loader.remove();
    submitButton.disabled = false;
    submitButton.style.pointerEvents = 'auto';
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      if (data.success) {
        ideaForm.reset();
        ideaForm.classList.remove('show');
        ideaForm.classList.add('hidden');
        overlay.classList.add('hidden');
        loadIdeas();
      }
    } else {
      const errorText = xhr.responseText;
      alert('Submission failed: ' + errorText);
      console.error('Submit error:', errorText);
    }
  };
  xhr.send(formData);
};

function loadTasks() {
  const container = document.getElementById('tasks-container');
  container.innerHTML = '<p><i class="fas fa-spinner fa-spin icon"></i> Loading tasks...</p>';

  fetch(`/api/tasks-list/${currentUser}`)
    .then(response => response.json())
    .then(tasks => {
      container.innerHTML = '';

      if (tasks.length === 0) {
        container.innerHTML = '<p><i class="fas fa-exclamation-circle icon"></i> No tasks found.</p>';
        return;
      }

      tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card';

        const deadlineDate = new Date(task.deadline);
        const id = `timer-${task.id}`;

        const statusIcon = task.completed ? '<i class="fas fa-check icon"></i>' : '<i class="fas fa-clock icon"></i>';
        const statusText = task.completed ? 'Done' : 'In Progress';
        const showTimer = !task.completed;

        let claimBtn = '';
        if (task.completed && !task.claimed) {
          claimBtn = `<button class="claim-btn" onclick="claimTask(${task.id}, '${task.title}', ${task.reward})"><i class="fas fa-coins icon"></i> Claim ${task.reward} pts</button>`;
        } else if (task.claimed) {
          claimBtn = `<p class="claimed-text"><i class="fas fa-check icon"></i> Claimed</p>`;
        }

        card.innerHTML = `
          <h3><i class="fas fa-tasks icon"></i> ${task.title}</h3>
          <p><i class="fas fa-trophy icon"></i> <strong>Reward:</strong> ${task.reward} pts</p>
          <p><i class="fas fa-calendar-alt icon"></i> <strong>Deadline:</strong> ${task.deadline}</p>
          <p>${statusIcon} <strong>Status:</strong> ${statusText}</p>
          ${showTimer ? `<p><i class="fas fa-hourglass-half icon"></i> <strong>Time Left:</strong> <span class="timer" id="${id}"></span></p>` : ''}
          ${claimBtn}
        `;

        container.appendChild(card);

        if (showTimer) {
          startCountdownTasks(deadlineDate, id);
        }
      });
    });
}

function claimTask(taskId, title, reward) {
  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin icon"></i> Claiming...';

  fetch(`/api/claim-task/${currentUser}/${taskId}`, {
    method: 'POST'
  })
    .then(res => res.json())
    .then(data => {
      showToastNotification(`Claimed ${reward} pts for "${title}"`);
      loadTasks();
    })
    .catch(err => {
      showToastNotification("Error claiming reward",'error');
      console.error(err);
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-coins icon"></i> Claim ${reward} pts`;
    });
}

function startCountdownTasks(deadline, elementId) {
  function updateTimer() {
    const now = new Date();
    const diff = deadline - now;

    const el = document.getElementById(elementId);
    if (!el) return;

    if (diff <= 0) {
      el.textContent = "Expired";
      el.style.color = 'red';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    el.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    if (diff < 3600000) { // Less than 1 hour
      el.style.color = 'red';
    } else if (diff < 86400000) { // Less than 1 day
      el.style.color = 'orange';
    } else {
      el.style.color = 'green';
    }
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

let currentLevelForAnalysis = null;
let currentUnitForAnalysis = null;

async function loadPersonalSummary(username, level, unit) {
  const summaryEl = document.getElementById('personal-summary');
  const suggestionsBtn = document.getElementById('detailed-suggestions-btn');
  const resultBox = document.getElementById('detailed-analysis');

  summaryEl.innerHTML = 'Loading...';
  suggestionsBtn.style.display = 'none';

  try {
    const res = await fetch(`/api/get-personal-suggestions?username=${username}&level=${level}&unit=${unit}`);
    const data = await res.json();

    if (data.error) {
      summaryEl.innerHTML = `<p style="color:red;">${data.error}</p>`;
      resultBox.innerHTML = '';
    } else {
      currentLevelForAnalysis = level;
      currentUnitForAnalysis = data.current_unit;

      summaryEl.innerHTML = `
        <p><span class="unit-badge">Previous Unit:</span> ${data.previous_unit}</p>
        <p><span class="unit-badge">Current Unit:</span> ${data.current_unit}</p>
        <ul>
          <li data-label="Grammar">Grammar change: ${data.grammar_change}</li>
          <li data-label="Vocabulary">Vocabulary change: ${data.vocabulary_change}</li>
          <li data-label="Organization">Organization change: ${data.organization_change}</li>
          <li data-label="Task Structure">Task structure change: ${data.task_structure_change}</li>
        </ul>
        <p class="comment"><span class="unit-badge">Summary:</span> ${data.comment}</p>
      `;

      const storageKey = `analysis_${username}_${level}_${data.current_unit}`;
      const savedAnalysis = localStorage.getItem(storageKey);

      if (savedAnalysis) {
        const a = JSON.parse(savedAnalysis);
        resultBox.innerHTML = `
          <h4>AI Detailed Feedback:</h4>
          <ul>
            <li data-label="Grammar">Grammar: ${a.grammar.change} — ${a.grammar.comment}</li>
            <li data-label="Vocabulary">Vocabulary: ${a.vocabulary.change} — ${a.vocabulary.comment}</li>
            <li data-label="Organization">Organization: ${a.organization.change} — ${a.organization.comment}</li>
            <li data-label="Task Structure">Task Structure: ${a.task_structure.change} — ${a.task_structure.comment}</li>
          </ul>
          <p class="summary"><span class="unit-badge">Summary:</span> ${a.overall_comment}</p>
        `;
      } else {
        resultBox.innerHTML = '';
        suggestionsBtn.style.display = 'inline-block';
      }
    }
  } catch (err) {
    summaryEl.innerHTML = `<p style="color:red;">Failed to load summary</p>`;
    console.error(err);
  }
}

document.getElementById('detailed-suggestions-btn').addEventListener('click', async () => {
  const resultBox = document.getElementById('detailed-analysis');
  resultBox.innerHTML = 'Analyzing...';
  document.getElementById('updateModal').style.display = 'flex';
  startUpdateStatusText();

  if (!currentLevelForAnalysis || !currentUnitForAnalysis) {
    resultBox.innerHTML = `<p style="color:red;">Missing level or unit data</p>`;
	document.getElementById('updateModal').style.display = 'none';
      stopUpdateStatusText();
    return;
  }

  const storageKey = `analysis_${currentUser}_${currentLevelForAnalysis}_${currentUnitForAnalysis}`;

  try {
    const res = await fetch(`/api/compare-essays-ai-get?username=${currentUser}&level=${currentLevelForAnalysis}&unit=${currentUnitForAnalysis}`);
    const data = await res.json();

    if (!data.success) {
      resultBox.innerHTML = `<p style="color:red;">${data.error}</p>`;
	  document.getElementById('updateModal').style.display = 'none';
      stopUpdateStatusText();
    } else {
		document.getElementById('updateModal').style.display = 'none';
      stopUpdateStatusText();
      const a = data.analysis;

      localStorage.setItem(storageKey, JSON.stringify(a));

      resultBox.innerHTML = `
        <h4>AI Detailed Feedback:</h4>
        <ul>
          <li data-label="Grammar">Grammar: ${a.grammar.change} — ${a.grammar.comment}</li>
          <li data-label="Vocabulary">Vocabulary: ${a.vocabulary.change} — ${a.vocabulary.comment}</li>
          <li data-label="Organization">Organization: ${a.organization.change} — ${a.organization.comment}</li>
          <li data-label="Task Structure">Task Structure: ${a.task_structure.change} — ${a.task_structure.comment}</li>
        </ul>
        <p class="summary"><span class="unit-badge">Summary:</span> ${a.overall_comment}</p>
      `;

      document.getElementById('detailed-suggestions-btn').style.display = 'none';
    }
  } catch (err) {
    resultBox.innerHTML = `<p style="color:red;">Failed to load detailed analysis</p>`;
	document.getElementById('updateModal').style.display = 'none';
      stopUpdateStatusText();
    console.error(err);
  }
});

function createVideoPlayer(videoPath, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Если уже есть плеер в этом контейнере — удаляем его
  const existingPlayer = container.querySelector('.video-player');
  if (existingPlayer) {
    existingPlayer.remove();
  }

  const player = document.createElement('div');
  player.className = 'video-player';
  player.innerHTML = `
    <div class="player-container">
      <div class="video-wrapper">
        <video class="video-element">
          <source src="${videoPath}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      </div>
      <div class="controls-overlay">
        <div class="top-controls">
          <img src="static/icons/squid-game.webp" alt="Squid Game" class="series-icon">
        </div>
        <div class="bottom-controls">
          <div class="right-controls">
            <button class="play-pause-btn"><i class="fas fa-play"></i></button>
            <button class="volume-btn"><i class="fas fa-volume-up"></i></button>
            <button class="fullscreen-btn"><i class="fas fa-expand"></i></button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(player);

  const video = player.querySelector('.video-element');
  const playPauseBtn = player.querySelector('.play-pause-btn');

  playPauseBtn.addEventListener('click', () => {
    if (video.paused) {
      video.play();
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      video.pause();
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
  });

  player.querySelector('.volume-btn').addEventListener('click', () => {
    video.muted = !video.muted;
  });

  player.querySelector('.fullscreen-btn').addEventListener('click', () => {
    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if (video.webkitRequestFullscreen) { /* Safari */
      video.webkitRequestFullscreen();
    } else if (video.msRequestFullscreen) { /* IE11 */
      video.msRequestFullscreen();
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const activeCountdownIntervals = {};

function startCountdownSquidTimer(targetDateStr, elementId) {
  const targetDate = new Date(targetDateStr).getTime();
  const container = document.getElementById(elementId);

  // Очистить предыдущий интервал, если он уже есть для этого элемента
  if (activeCountdownIntervals[elementId]) {
    clearInterval(activeCountdownIntervals[elementId]);
  }

  let previousDigits = "";

  function animateDigitChange(oldChar, newChar, index) {
    const span = document.createElement('span');
    span.className = 'countdown-digit';
    span.textContent = newChar;
    span.style.animation = 'countdownDigitIn 0.4s ease-out';
    return span;
  }

  function renderStatusMessage(text) {
    container.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'countdown-digit';
    span.textContent = text;
    container.appendChild(span);
  }

  function updateCountdown() {
    const now = new Date().getTime();
    const distance = targetDate - now;

    if (distance <= 0) {
      const passedSince = now - targetDate;

      if (passedSince < 60 * 1000) {
        renderStatusMessage('In progress');
      } else {
        renderStatusMessage('Passed');
      }

      clearInterval(activeCountdownIntervals[elementId]);
      delete activeCountdownIntervals[elementId];
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    const formatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    container.innerHTML = '';

    for (let i = 0; i < formatted.length; i++) {
      const newChar = formatted[i];
      const oldChar = previousDigits[i] || '';

      if (newChar !== oldChar) {
        const digitEl = animateDigitChange(oldChar, newChar, i);
        container.appendChild(digitEl);
      } else {
        const span = document.createElement('span');
        span.className = 'countdown-digit';
        span.textContent = newChar;
        container.appendChild(span);
      }
    }

    previousDigits = formatted;
  }

  // Сохраняем интервал для этого элемента
  activeCountdownIntervals[elementId] = setInterval(updateCountdown, 1000);
  updateCountdown();
}

async function openLiveLesson() {
  const unit = currentUnit;
  const container = document.getElementById("liveLessonBlock");
  const wrapper = document.getElementById("liveLesson");

  if (!container || !wrapper) return;

  wrapper.style.display = 'block';
  container.innerHTML = `
    <div class="tab-title">Loading Live Lesson Unit ${unit}...</div>
    <div class="unit-content"><p>Loading...</p></div>
  `;

  try {
    const response = await fetch(`/static/liveLessons/Unit${unit}.html`);
    const rawHTML = await response.text();

    const titleMatch   = rawHTML.match(/<!--\s*tab-title\s*-->([\s\S]*?)<!--\s*\/tab-title\s*-->/);
    const contentMatch = rawHTML.match(/<!--\s*content\s*-->([\s\S]*?)<!--\s*\/content\s*-->/);

    const tabTitle = titleMatch ? titleMatch[1].trim() : `Unit ${unit}`;
    const content  = contentMatch ? contentMatch[1].trim() : rawHTML;

    container.innerHTML = `
      <div class="tab-title">${tabTitle}</div>
      <div class="unit-content grammar-section">
        ${content}
      </div>
    `;
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <div class="tab-title">Live Lesson: Unit ${unit}</div>
      <div class="unit-content">
        <p class="error">Could not load content.</p>
      </div>
    `;
  }
}

  document.getElementById("current-unit-value").addEventListener("click", function() {
    showPage("liveLesson");
  });
  
// showWritingTopList() — единственная внешняя функция.
// showWritingTopList() — единственная внешняя функция.
function showWritingTopList() {
  // Конфиг / глобалы
  const unit = (typeof currentUnit !== 'undefined' && currentUnit) ? currentUnit : (document.getElementById('todaytasks-unit')?.textContent || '1.0');
  const level = (typeof currentLevel !== 'undefined' && currentLevel) ? currentLevel : 'Beginner';
  const userName = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : (window.APP_USER || 'You');

  const page = document.getElementById('writing-top-list');
  if (!page) { console.warn('writing-top-list element not found'); return; }

  // Обёртка .wtl-card (если нет)
  if (!page.querySelector('.wtl-card')) {
    const inner = document.createElement('div');
    inner.className = 'wtl-card';
    while (page.firstChild) inner.appendChild(page.firstChild);
    page.appendChild(inner);
  }

  // Показать только эту страницу
  document.querySelectorAll('.page').forEach(p => { if (p !== page) p.style.display = 'none'; });
  page.style.display = 'block';
  page.querySelector('.wtl-card').classList.add('show');

  // Элементы
  const posEl = page.querySelector('#wtl-position');
  const unitEl = page.querySelector('#wtl-unit');
  const levelEl = page.querySelector('#wtl-level');
  const listEl = page.querySelector('#wtl-list');
  const refreshBtn = page.querySelector('#wtl-refresh');
  const bestStatEl = page.querySelector('#wtl-best');
  const avgStatEl = page.querySelector('#wtl-avg');
  const diffStatEl = page.querySelector('#wtl-diff');
  let canvas = page.querySelector('#writing-chart');

  if (!listEl) {
    const ln = document.createElement('div'); ln.id = 'wtl-list'; ln.className = 'wtl-list';
    page.querySelector('.wtl-card').appendChild(ln);
  }
  if (!canvas) {
    const wrap = document.createElement('div'); wrap.className = 'wtl-chart-wrap';
    canvas = document.createElement('canvas'); canvas.id = 'writing-chart';
    wrap.appendChild(canvas);
    page.querySelector('.wtl-card').insertBefore(wrap, page.querySelector('#wtl-list'));
  }

  unitEl && (unitEl.textContent = unit);
  levelEl && (levelEl.textContent = level);
  posEl && (posEl.textContent = 'Loading...');

  if (!window._writingTopChart) window._writingTopChart = null;

  function findWritingKey(obj) {
    if (!obj) return null;
    return Object.keys(obj).find(k => k.toLowerCase().includes('writing')) || null;
  }

  function extractWritingPercent(wobj) {
    if (!wobj) return null;
    if (typeof wobj.percent === 'number') return Math.max(0, Math.min(100, wobj.percent));
    if (typeof wobj.score === 'number' && typeof wobj.total === 'number') {
      return wobj.total ? Math.round((wobj.score / wobj.total) * 100) : 0;
    }
    if (typeof wobj.correct === 'number' && typeof wobj.total === 'number') {
      return wobj.total ? Math.round((wobj.correct / wobj.total) * 100) : 0;
    }
    return null;
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleString();
  }

  function renderList(entries, currentPlace) {
    const list = page.querySelector('#wtl-list');
    list.innerHTML = '';
    entries.forEach((e, idx) => {
      const row = document.createElement('div');
      row.className = 'wtl-item' + ((currentPlace && idx === currentPlace - 1) ? ' current' : '');
      row.style.animation = `fadeIn 0.4s ease ${idx * 0.05}s both`;
      row.innerHTML = `
        <div class="left">
          <div class="wtl-rank">${idx + 1}</div>
          <div class="wtl-user">
            <div class="name">${escapeHtml(e.username)}</div>
            <div class="time">Last: ${escapeHtml(formatDate(e.lastTime))}</div>
          </div>
        </div>
        <div class="wtl-score">${escapeHtml(String(e.best))}%</div>
      `;
      if (currentPlace && idx === currentPlace - 1) row.classList.add('current');
      list.appendChild(row);
    });
  }

  async function buildChart(entries) {
    if (window._writingTopChart) {
      window._writingTopChart.destroy();
      window._writingTopChart = null;
    }

    const labels = entries.map(e => e.username.length > 14 ? e.username.slice(0, 13) + '…' : e.username);
    const bestData = entries.map(e => e.best);

    const ctx = canvas.getContext('2d');
    window._writingTopChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Percentage',
            data: bestData,
            backgroundColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return '#42a5f5';
              const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              grad.addColorStop(0, 'rgba(33,150,243,0.9)');
              grad.addColorStop(1, 'rgba(3,169,244,0.4)');
              return grad;
            },
            borderRadius: 8,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutCubic' },
        scales: {
          x: { ticks: { color: '#d6d9e6' }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#d6d9e6' }, grid: { color: 'rgba(255,255,255,0.06)' } }
        },
        plugins: {
          legend: { labels: { color: '#fff' } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const idx = ctx.dataIndex;
                const original = entries[idx];
                return ` ${original.username} — ${original.best}%`;
              }
            }
          }
        }
      }
    });

    const wrap = page.querySelector('.wtl-chart-wrap') || canvas.parentElement;
    if (wrap) {
      wrap.style.height = Math.max(240, Math.min(420, labels.length * 36)) + 'px';
    }
  }

  async function fetchAndRender() {
    posEl && (posEl.textContent = 'Loading...');
    page.querySelector('#wtl-list').innerHTML = '';

    let json;
    try {
      const res = await fetch(`/api/get-results?level=${encodeURIComponent(level)}&unit=${encodeURIComponent(unit)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      json = await res.json();
    } catch (err) {
      posEl && (posEl.textContent = '#—');
      page.querySelector('#wtl-list').innerHTML = `<div style="padding:12px;color:#ffdede">Error: ${escapeHtml(err.message)}</div>`;
      if (window._writingTopChart) window._writingTopChart.destroy();
      return;
    }

    const arr = [];
    for (const [username, userObj] of Object.entries(json || {})) {
      const wkey = findWritingKey(userObj);
      if (!wkey) continue;
      const wlist = Array.isArray(userObj[wkey]) ? userObj[wkey] : [userObj[wkey]];

      const percents = wlist.map(extractWritingPercent).filter(p => p !== null);
      if (!percents.length) continue;

      const best = Math.max(...percents);
      const avg = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
      const lastTime = wlist.map(w => w?.time).filter(Boolean).sort().pop() || null;

      arr.push({ username, best, avg, lastTime });
    }

    if (!arr.length) {
      posEl && (posEl.textContent = '#—');
      page.querySelector('#wtl-list').innerHTML = `<div style="padding:12px;color:#ffdede">No Writing AI results for this unit.</div>`;
      if (window._writingTopChart) window._writingTopChart.destroy();
      return;
    }

    arr.sort((a, b) => {
      if (b.best !== a.best) return b.best - a.best;
      if (a.lastTime && b.lastTime) return new Date(b.lastTime) - new Date(a.lastTime);
      return a.username.localeCompare(b.username);
    });

    let idx = arr.findIndex(e => e.username === userName);
    if (idx === -1) {
      const low = userName.toLowerCase();
      idx = arr.findIndex(e => e.username.toLowerCase() === low);
    }
    const place = idx === -1 ? null : idx + 1;
    posEl && (posEl.textContent = place ? `#${place}` : '#—');

    // статистика по всем пользователям
    const maxBestAll = Math.max(...arr.map(u => u.best));
    const avgAvgAll = Math.round(arr.reduce((sum, u) => sum + u.avg, 0) / arr.length);
    const leaderBest = arr[0].best;
    const avgDiffAll = Math.round(arr.reduce((sum, u) => sum + (leaderBest - u.best), 0) / arr.length);

    bestStatEl && (bestStatEl.textContent = `${maxBestAll}%`);
    avgStatEl && (avgStatEl.textContent = `${avgAvgAll}%`);
    diffStatEl && (diffStatEl.textContent = `${avgDiffAll}%`);

    renderList(arr, place);
    await buildChart(arr);
  }

  if (refreshBtn) refreshBtn.onclick = fetchAndRender;

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window._writingTopChart) window._writingTopChart.resize();
    }, 200);
  });

  fetchAndRender();
  window.reloadWritingTopList = fetchAndRender;
}

function loadCertificates(currentLevel) {
  const levels = ['Beginner', 'Elementary', 'Pre-Intermediate', 'Intermediate', 'IELTS L1', 'IELTS L2'];
  const container = document.getElementById('certificates-container');
  container.innerHTML = '';

  const zoomLevel = 60;
  const unitValue = parseFloat(currentUnit);

  levels.forEach((level, index) => {
    let status, statusText;

    if (level === currentLevel && unitValue < 12.3 && unitValue !== 0) {
      status = 'in-progress';
      statusText = 'In Progress';
    } else if (level === currentLevel && unitValue > 12.3) {
      status = 'in-progress';
      statusText = 'Generating';
    } else if (level === currentLevel && unitValue === 0) {
      status = 'completed';
      statusText = 'Completed';
    } else if (levels.indexOf(currentLevel) > index) {
      status = 'completed';
      statusText = 'Completed';
    } else {
      status = 'locked';
      statusText = 'Locked';
    }

    // Создаём обёртку карточки
    const wrapper = document.createElement('div');
    wrapper.className = 'certificate-wrapper';

    // Создаём карточку
    const card = document.createElement('div');
    card.className = `certificate-card ${status}`;
    card.innerHTML = `
      <div class="certificate-image-wrapper">
        <img class="certificate-image" src="/static/certificates/preview/${encodeURIComponent(level)}.png" alt="${level} Certificate" onerror="this.src='/static/certificates/preview/NoPhoto.png';">
      </div>
      <div class="certificate-info">
        <div class="certificate-title">${level}</div>
        <div class="certificate-status">${statusText}</div>
      </div>
    `;

    if (status === 'in-progress' || status === 'locked') {
      const overlay = document.createElement('div');
      overlay.className = 'certificate-overlay';
      let iconHtml = '';

      if (status === 'in-progress') {
        iconHtml = `
          <div class="spinner">
            ${Array.from({ length: 12 }).map(() => '<div class="spinner-blade"></div>').join('')}
          </div>
        `;
      } else {
        iconHtml = '<i class="fas fa-lock overlay-icon"></i>';
      }

      overlay.innerHTML = `
        <div class="overlay-button">
          ${iconHtml}
          <span class="overlay-text">${statusText}</span>
        </div>
      `;
      card.querySelector('.certificate-image-wrapper').appendChild(overlay);
    } else if (status === 'completed') {
      card.addEventListener('click', () => {
        const pdfUrl = `/static/certificates/completed/${encodeURIComponent(level)}/${currentUser}.pdf`;
        const pdfUrlWithZoom = `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=${zoomLevel}`;

        const certificateView = document.createElement('div');
        certificateView.id = 'certificate-view';
        certificateView.innerHTML = `
          <div id="certificate-panel">
            <button id="back-btn">&lt;</button>
            <div id="pdf-container">
              <iframe id="pdf-frame" src="${pdfUrlWithZoom}"></iframe>
            </div>
            <div id="button-container">
              <button id="download-btn"><i class="fas fa-download"></i> Download</button>
            </div>
          </div>
        `;
        document.body.appendChild(certificateView);

        certificateView.querySelector('#back-btn').addEventListener('click', () => certificateView.remove());
        certificateView.querySelector('#download-btn').addEventListener('click', () => {
          const link = document.createElement('a');
          link.href = pdfUrl;
          link.download = `${level}_${currentUser}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
        });
      });
    }

    // Вставляем карточку в обёртку
    wrapper.appendChild(card);
    container.appendChild(wrapper);
  });
}

const header = document.getElementById('todaytasks-header');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;

  if (scrollTop > lastScroll && scrollTop > 10) {
    header.classList.add('sticky-active');
  } else if (scrollTop <= 10) {
    header.classList.remove('sticky-active');
  }

  lastScroll = scrollTop;
});

// Глобальный обработчик наведения
document.addEventListener('mouseover', function (e) {
  const target = e.target.closest('.exam-subquestion');
  if (target) {
    target.querySelectorAll('input.write-in-blank-input').forEach(inp => {
      inp.type = 'password';
    });
  }
});

document.addEventListener('mouseout', function (e) {
  const target = e.target.closest('.exam-subquestion');
  if (target) {
    target.querySelectorAll('input.write-in-blank-input').forEach(inp => {
      inp.type = 'text';
    });
  }
});
