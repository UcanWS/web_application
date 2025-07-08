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

function showPage(id) {
  let [pageId, subPage] = id.split('/');

  // Страницы, запрещённые для должников
  const blockedPages = ['chat-list', 'progress', 'shop','coins-page'];
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
      loadPrivateChatUsers(); // <-- загружаем юзеров
      break;
	  
	case 'chat-ui-private':
      hideNavigation();
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
      const coinsReceived = pointsToExchange / 10;

      loadPointsHistory(username);
      loadUserCoins(username);
      loadUserPoints(username);
      updateCoinsValue();

      sessionStorage.removeItem("userPoints");

      statusEl.textContent = `✅ Exchanged successfully! You received ${coinsReceived} coins`;
      statusEl.className = "exchange-success flash";
      showModalStatus(`You received ${coinsReceived} coins`, "success");

      document.getElementById("exchange-input").value = "";
    } else {
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
          <th>Progress %</th>
        </tr>
      `;
      unitsTableHead.innerHTML = '';
    } else if (view === "today") {
      fixedTableHead.innerHTML = `
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Today %</th>
        </tr>
      `;
      const currentUnitIndex = Units.indexOf(activeCurrentUnit);
      const relevantUnits = currentUnitIndex >= 0 ? Units.slice(0, currentUnitIndex + 1) : [];
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = relevantUnits.map(unit => `<th>Unit ${unit}</th>`).join('');
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
      const relevantUnits = Units;
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

	/*
	document.addEventListener("DOMContentLoaded", function() {
    // Предполагаем, что currentUser — это строка с именем пользователя
    const username = currentUser.trim(); // Убираем лишние пробелы
    console.info("Текущий пользователь:", username); // Логируем имя пользователя

    fetch('/api/leaderboard')
        .then(response => {
            console.log("Запрос к /api/leaderboard отправлен"); // Логируем начало запроса
            return response.json();
        })
        .then(data => {
            // Находим элемент с id="leaderboard-value"
            const leaderboardValue = document.getElementById("leaderboard-value");
            if (!leaderboardValue) {
                console.warn("Элемент leaderboard-value не найден."); // Предупреждение, если элемент отсутствует
                return;
            }

            // Проверяем, существует ли username
            if (!username) {
                console.error("Текущий пользователь не определен."); // Ошибка, если username пустой
                return;
            }

            // Собираем полный список игроков (топ-3 + остальные)
            let allPlayers = [...data.top_3, ...data.others];
            console.log("Список игроков:", allPlayers.map(player => player.name)); // Логируем имена игроков

            // Находим ранг пользователя с учетом регистра
            let userRank = allPlayers.findIndex(player => player.name.trim().toLowerCase() === username.toLowerCase()) + 1;
            console.info("Ранг пользователя:", userRank); // Логируем найденный ранг

            // Обновляем текст элемента
            if (userRank > 0) {
                leaderboardValue.innerText = `#${userRank}`; // Пользователь найден
                console.log(`Элемент leaderboard-value обновлен: #${userRank}`); // Логируем успешное обновление
            } else {
                leaderboardValue.innerText = `#?`; // Пользователь не найден
                console.warn("Пользователь не найден в таблице лидеров"); // Предупреждение, если пользователь не найден
            }
        })
        .catch(error => {
            console.error("Ошибка при загрузке таблицы лидеров:", error); // Ошибка уже логируется
        });
		// Запрос для получения баланса пользователя
    fetch(`/api/get_balance/${username}`)
        .then(response => {
            console.log("Запрос к /api/get_balance отправлен");
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const pointsValue = document.getElementById("points-value");
            if (!pointsValue) {
                console.warn("Элемент points-value не найден.");
                return;
            }

            pointsValue.innerText = data.balance;
            console.log(`Элемент points-value обновлен: ${data.balance}`);
        })
        .catch(error => {
            console.error("Ошибка при загрузке баланса:", error);
            const pointsValue = document.getElementById("points-value");
            if (pointsValue) {
                pointsValue.innerText = "--";
            }
        });
});*/

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
async function updateLeaderboardUI() {
    const leaderboardContainer = document.getElementById('leaderboard-container');
    if (!leaderboardContainer) {
        console.error('Leaderboard container element not found');
        return;
    }

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

    try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        let leaderboardHTML = `
            <div class="leaderboard">
                <button class="back-button" onclick="window.history.back()">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <h2>Leaderboard</h2>
                <div class="top-3">`;

        const topOrder = [1, 0, 2]; // Центровка: 2-й, 1-й, 3-й

        for (let i of topOrder) {
            const player = data.top_3[i];
            const avatar = await fetchAvatar(player.name);
            const rank = i + 1;
            const suffix = getRankSuffix(rank);

            leaderboardHTML += `
                <div class="top-player">
                    <div class="leaderboard-avatar">${avatar}</div>
                    <div class="rank-number">${rank}${suffix}</div>
                    <p>${player.name}</p>
                    <p style="opacity: 0.8; font-size: 0.9em;">
                        ${player.coins} <i class="fas fa-star"></i>
                    </p>
                </div>`;
        }

        leaderboardHTML += `</div><ul class="leaderboard-list">`;
        const colors = ['#ffa500', '#ff8c00', '#f39c12', '#e74c3c', '#c0392b'];
        let rank = 4;

        for (let i = 0; i < data.others.length; i++) {
            const player = data.others[i];
            const avatar = await fetchAvatar(player.name);
            const color = colors[i] || '#555';
            const suffix = getRankSuffix(rank);

            leaderboardHTML += `
                <li class="leaderboard-item">
                    <div class="leaderboard-avatar">${avatar}</div>
                    <span class="leaderboard-name">${player.name}</span>
                    <span class="rank-badge" style="background:${color}">${rank}${suffix}</span>
                    <span class="leaderboard-rank">${player.coins} <i class="fas fa-star"></i></span>
                </li>`;
            rank++;
        }

        leaderboardHTML += `</ul></div>`;
        leaderboardContainer.innerHTML = leaderboardHTML;
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        leaderboardContainer.innerHTML = "<p>Error loading leaderboard. Please try again later.</p>";
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
async function fetchAvatar(name) {
    const safeName = name.trim();
    const fallback = `<div class="avatar-placeholder">${safeName.charAt(0).toUpperCase()}</div>`;

    try {
        const response = await fetch(`/get_avatar/${encodeURIComponent(safeName)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.avatar_url) {
            return `<img src="${data.avatar_url}" alt="${safeName}" class="avatar">`;
        } else {
            return fallback;
        }
    } catch (error) {
        console.warn(`Avatar not found for "${safeName}":`, error);
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
  nav.classList.add('nav-hidden');
}

function showNavigation() {
  const nav = document.querySelector('nav');
  nav.classList.remove('nav-hidden');
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




// ----------------------------
// 1. Рендер списка Today’s Tasks с лоадером и центрированием
// ----------------------------
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

  const spinner = document.createElement('div');
  spinner.className = 'lds-spinner';
  for (let i = 0; i < 12; i++) spinner.appendChild(document.createElement('div'));
  section.appendChild(spinner);
  container.appendChild(section);

  try {
    const [tasksRes, resultsRes] = await Promise.all([
      fetch(`/api/get-today-questions?level=${encodeURIComponent(currentLevel)}&unit=${encodeURIComponent(currentUnit)}`),
      fetch(`/api/get-results?level=${encodeURIComponent(currentLevel)}&unit=${encodeURIComponent(currentUnit)}`)
    ]);
    if (!tasksRes.ok || !resultsRes.ok) throw new Error('Ошибка запроса');

    const { today_tasks } = await tasksRes.json();
    const resultsData = await resultsRes.json();
    const userResult = resultsData[currentUser] || {};

    section.classList.remove('loading');
    section.innerHTML = `<h2 id="task-count">Today's Tasks</h2>`;

    const typePriority = ['homework', 'grammar', 'vocabulary', 'listening', 'reading'];

    // Отдельно обрабатываем экзамен
    let examTask = null;
    let filteredTasks = today_tasks.filter(block => {
      const lowerTitle = block.title.toLowerCase();
      if (lowerTitle.includes('final exam') || lowerTitle.includes('weekly exam')) {
        examTask = block;
        return false;
      }
      return true;
    });

    const showExam = typeof remainingTime === 'number' && remainingTime >= 0;

    if ((!filteredTasks.length && !examTask && !showExam)) {
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
      if (isCompleted) card.classList.add('disabled');
      if (!isCompleted) {
        card.onclick = () => openTodayTaskPage(title, block.questions);
        card.classList.add('clickable');
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
      textGroup.append(titleDiv, progressContainer);

      const award = document.createElement('div');
      award.className = 'task-progress-award';
      if (hasReward) {
        award.innerHTML = `<i class="fa-solid fa-star"></i> 100`;
        award.classList.add('pop-bounce');
      } else {
        award.style.display = 'none';
      }

      card.append(icon, textGroup, award);
      section.appendChild(card);
    });

    // Показываем экзамен (Final Exam / Weekly Exam)
    if (examTask || showExam) {
      window.examTaskTitle = examTask?.title || 'Exam';

      const finalExamContainer = document.createElement('div');
      finalExamContainer.className = 'accordion';
      finalExamContainer.innerHTML = `
        <div class="accordion-header" onclick="toggleAccordion(this)">
          <span>${examTask?.title || 'Exam'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="accordion-content" id="final-exam-item">
          <!-- Контент загружается через updateExamDisplay() -->
        </div>
      `;
      section.appendChild(finalExamContainer);

      updateExamDisplay();
    }

    updateTaskCount();
  } catch (err) {
    section.style.display = 'none';
    console.error('[Tasks] ❌ Ошибка загрузки заданий:', err);
    renderNoTasksPlaceholder(container);
  }
}








// ----------------------------
// 2. Открытие страницы с вопросами и рендер
// ----------------------------
function openTodayTaskPage(title, questions) {
  initExamSecurity(true);
  hideNavigation();
  showPage('todaytasks');
  document.getElementById('header-today').textContent = title;
  document.getElementById('todaytasks-unit').textContent = `Unit ${currentUnit}`;
  const content = document.getElementById('todaytasks-content');
  content.innerHTML = '';

  questions.forEach((q, qi) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'exam-question-block';

    if (q.type === 'reading' && q.text) {
      const rich = document.createElement('div');
      rich.className = 'exam-parent-question';
      rich.innerHTML = q.text;
      wrapper.appendChild(rich);
    }

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
      wrapper.appendChild(div.firstElementChild);
    }

    if (q.text && q.type !== 'reading') {
      const heading = document.createElement('h3');
      heading.className = 'question-title';
      heading.innerHTML = `${qi + 1}. ${q.text}`;
      wrapper.appendChild(heading);
    }

    const subList = Array.isArray(q.subquestions) ? q.subquestions : [q];
    const groupedBoxChoose = [];
    const groupedWriteIn = [];

    subList.forEach(sub => {
      if (sub.type === 'box-choose') {
        groupedBoxChoose.push(sub);
      } else if (sub.type === 'write-in-blank') {
        groupedWriteIn.push(sub);
      }
    });

    subList.forEach(sub => {
      if (sub.type === 'box-choose' || sub.type === 'write-in-blank') return;
      const subDiv = document.createElement('div');
      subDiv.className = 'exam-subquestion';

      if (sub.type !== 'unscramble') {
        const p = document.createElement('p');
        p.className = 'question-text';
        p.innerHTML = `${sub.id || 'Q'}. ${sub.text || ''}`;
        subDiv.appendChild(p);
      }

      const group = document.createElement('div');
      group.className = 'question-options';

      if (['multiple_choice', 'true_false'].includes(sub.type)) {
        (sub.options || ['True', 'False']).forEach((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const id = `opt-${sub.id}-${letter}`;
          group.innerHTML += `
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

        group.appendChild(letterContainer);
        group.appendChild(inputContainer);

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
        if (sub.image) group.innerHTML += `<img src="${sub.image}" alt="Image" class="question-image">`;
        group.innerHTML += `<input type="text" name="q${sub.id}" class="image-answer" placeholder="Answer...">`;
      } else if (sub.type === 'listening') {
        group.innerHTML = `<input type="text" name="q${sub.id}" class="listening-input" placeholder="Your answer...">`;
      }

      subDiv.appendChild(group);
      wrapper.appendChild(subDiv);
    });

    if (groupedWriteIn.length) {
      const subDiv = document.createElement('div');
      subDiv.className = 'exam-subquestion';
      groupedWriteIn.forEach(sub => {
        const p = document.createElement('p');
        p.className = 'question-text';
        p.innerHTML = `${sub.id}. ${sub.text.replace('____', `<input type="text" class="write-in-blank-input" name="q${sub.id}" placeholder="____" autocomplete="off">`)}`;
        subDiv.appendChild(p);
      });
      wrapper.appendChild(subDiv);
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

      wrapper.appendChild(subDiv);
    }

    content.appendChild(wrapper);
  });

  document.getElementById('finish-tasks-btn').onclick = () => {
    const btn = document.getElementById('floating-finish-btn');
    if (btn) btn.style.display = 'none';
    finishTodayTasks(title, questions);
  };

  document.getElementById('done-tasks-btn').onclick = () => {
    showPage('today');
    content.innerHTML = '';
    document.getElementById('done-tasks-btn').style.display = 'none';
    document.getElementById('finish-tasks-btn').style.display = 'inline-block';
    const floating = document.getElementById('floating-finish-btn');
    if (floating) floating.style.display = 'none';
  };

  // Create floating finish button
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
    finishTodayTasks(title, questions);
  };

  initCustomAudioPlayers();
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


function renderSubquestion(sub, container) {
  const subDiv = document.createElement('div');
  subDiv.className = 'subquestion';

  // Если это reading type, отображаем rich block
  if (sub.type === 'reading' && sub.text) {
    const readingBlock = document.createElement('div');
    readingBlock.className = 'exam-parent-question';
    readingBlock.innerHTML = sub.text;
    subDiv.appendChild(readingBlock);
    container.appendChild(subDiv);
    return;
  }

  // Вставка текста вопроса
  let questionHTML = sub.text || '(no question text)';
  if (sub.type === 'write-in-blank' && questionHTML.includes('____')) {
    const inputHTML = `<input type="text" name="q${sub.id}" class="write-in-blank-input" placeholder="Answer...">`;
    questionHTML = questionHTML.replace('____', inputHTML);
  }

  const p = document.createElement('p');
  p.innerHTML = questionHTML;
  subDiv.appendChild(p);

  switch (sub.type) {
    case 'multiple_choice':
    case 'true_false':
      (sub.options || ['True', 'False']).forEach((opt, i) => {
        const id = `opt-${sub.id}-${opt.replace(/\s+/g, '')}`;
        const letter = String.fromCharCode(65 + i);
        subDiv.insertAdjacentHTML('beforeend', `
          <div class="option-group">
            <input type="radio" name="q${sub.id}" value="${opt}" id="${id}">
            <label for="${id}">
              <span class="option-letter">${letter}</span>
              <span class="option-text">${opt}</span>
            </label>
          </div>
        `);
      });
      break;

    case 'box-choose': {
      const blankId = `blank-${sub.id}`;
      const textWithBlank = (sub.text || '').replace(
        '____',
        `<span class="box-choose-blank" id="${blankId}" data-qid="${sub.id}" data-active="false">_____</span>`
      );

      const textP = document.createElement('p');
      textP.innerHTML = textWithBlank;
      subDiv.appendChild(textP);

      const optionsDiv = document.createElement('div');
      optionsDiv.className = 'box-choose-options';

      let selectedOption = null;

      (sub.options || []).forEach((opt, i) => {
        const optEl = document.createElement('span');
        optEl.className = 'box-choose-option';
        optEl.textContent = opt;
        optEl.style.setProperty('--index', i); // for animation delay

        optEl.addEventListener('click', () => {
          // Remove previous selections
          optionsDiv.querySelectorAll('.box-choose-option').forEach(el => el.classList.remove('selected'));
          optEl.classList.add('selected');
          selectedOption = opt;

          // Highlight empty blanks
          subDiv.querySelectorAll('.box-choose-blank').forEach(blank => {
            if (!blank.textContent || blank.textContent === '_____') {
              blank.classList.add('highlight-pending');
              blank.style.borderColor = '#4a90e2';
            }
          });
        });

        optionsDiv.appendChild(optEl);
      });

      subDiv.appendChild(optionsDiv);

      setTimeout(() => {
        const blank = document.getElementById(blankId);
        if (blank) {
          blank.onclick = () => {
            if (!selectedOption) return;

            blank.textContent = selectedOption;
            blank.dataset.value = selectedOption;
            blank.dataset.active = 'false';
            blank.classList.remove('highlight-pending');
            blank.style.borderColor = '';

            // Remove selected option
            optionsDiv.querySelectorAll('.box-choose-option').forEach(optEl => {
              if (optEl.textContent === selectedOption) {
                optEl.classList.remove('selected');
                optEl.classList.add('used');
                setTimeout(() => optEl.remove(), 500);
              }
            });

            selectedOption = null;
          };
        }
      }, 0);

      break;
    }

    case 'unscramble':
      const letters = (sub.text || '').split('');
      const shuffled = [...letters].sort(() => Math.random() - 0.5);

      const dragContainer = document.createElement('div');
      dragContainer.className = 'unscramble-container';

      shuffled.forEach((char, i) => {
        const el = document.createElement('span');
        el.className = 'unscramble-letter';
        el.textContent = char;
        el.draggable = true;
        el.setAttribute('data-char', char);
        dragContainer.appendChild(el);
      });

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Type or drag letters...';
      input.name = `q${sub.id}`;
      input.className = 'unscramble-input';

      subDiv.appendChild(dragContainer);
      subDiv.appendChild(input);
      break;

    case 'question':
      subDiv.innerHTML += `
        <textarea name="q${sub.id}" placeholder="Your response..." class="question-textarea"></textarea>
      `;
      break;

    case 'picture':
      if (sub.image) {
        subDiv.innerHTML += `<img src="${sub.image}" alt="Image for question" class="question-image">`;
      }
      subDiv.innerHTML += `
        <input type="text" name="q${sub.id}" placeholder="Answer based on image..." class="image-answer">
      `;
      break;

    default:
      subDiv.innerHTML += `
        <input type="text" name="q${sub.id}" placeholder="Answer..." class="default-text-input">
      `;
  }

  container.appendChild(subDiv);
}



// ----------------------------
// 3. Сбор ответов и отправка на сервер с результатом и ошибками
// ----------------------------
function finishTodayTasks(title, questions) {
  initExamSecurity(false);
  showNavigation();
  const answers = {};
  const errors = [];
  const content = document.getElementById('todaytasks-content');

  // 1. Обычные input/textarea
  content.querySelectorAll('input[name^="q"], textarea[name^="q"]').forEach(el => {
    const qid = el.name.slice(1);
    if (el.type === 'radio') {
      if (el.checked) answers[qid] = el.value;
    } else {
      const val = el.value.trim();
      if (val) answers[qid] = val;
    }
  });

  // 2. box-choose blanks
  content.querySelectorAll('.box-choose-blank').forEach(blank => {
    const qid = blank.dataset.qid;
    const val = blank.dataset.value;
    if (val) answers[qid] = val;
    else errors.push(`Please complete box-choose for question ${qid}`);
  });

  // 3. unscramble
  content.querySelectorAll('.unscramble-inputs').forEach(group => {
    const qid = group.dataset.qid;
    const inputs = group.querySelectorAll('.unscramble-input');
    const text = Array.from(inputs).map(span => span.textContent.trim()).join('');
    if (qid) {
      if (text) answers[qid] = text;
      else errors.push(`Unscramble incomplete for question ${qid}`);
    }
  });

  // 4. listening
  content.querySelectorAll('.listening-input').forEach(input => {
    const qid = input.name?.slice(1);
    const val = input.value.trim();
    if (qid && val) answers[qid] = val;
    else if (qid) errors.push(`Listening answer missing for question ${qid}`);
  });

  // 5. Проверка ошибок
  if (errors.length) {
    showToastNotification(errors[0], 'warning');
    return;
  }

  const payload = {
    level: currentLevel,
    unit: currentUnit,
    username: currentUser,
    title,
    answers
  };

  // ПОКАЗАТЬ МОДАЛКУ
  document.getElementById('updateModal').style.display = 'flex';
  startUpdateStatusText();

  fetch('/api/submit-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      // СКРЫТЬ МОДАЛКУ
      document.getElementById('updateModal').style.display = 'none';
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
          const sub = (q.subquestions || []).find(sq => sq.id === item.q) || q;

          resultHTML.push(`<div class="exam-subquestion" style="margin: 16px 0;">`);
          resultHTML.push(`<p class="question-text"><strong>${item.q}.</strong> ${sub.text || ''}</p>`);

          // multiple-choice / true-false
          if (sub.type === 'true_false' || (sub.type === 'multiple_choice' && Array.isArray(sub.options))) {
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
          else if (sub.type === 'box-choose') {
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
          else if (sub.type === 'unscramble') {
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

          // текст
          else {
            resultHTML.push(`<p><strong>Your Answer:</strong> <span style="color: #f44336;">${item.user || '—'}</span></p>`);
            resultHTML.push(`<p><strong>Correct Answer:</strong> <span style="color: #4caf50;">${item.correct}</span></p>`);
          }

          resultHTML.push(`</div>`);
        });
      } else {
        resultHTML.push(`<p style="color: #4caf50;">🎉 Excellent! You answered all questions correctly.</p>`);
      }

      content.innerHTML = resultHTML.join('');

      // Кнопки
      document.getElementById('finish-tasks-btn').style.display = 'none';
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
          content.innerHTML = '';
          doneBtn.style.display = 'none';
          document.getElementById('finish-tasks-btn').style.display = 'inline-block';
        };
        document.getElementById('todaytasks-header').appendChild(doneBtn);
      } else {
        doneBtn.style.display = 'inline-block';
      }
    })
    .catch(err => {
      console.error(err);
      document.getElementById('updateModal').style.display = 'none'; // скрываем даже при ошибке
      showToastNotification(err.message, 'error');
    });
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

const blockStates = new Map(); // { username: { isBlocked, timerInterval, blockEndTime } }

// Функция для форматирования времени в формате MM:SS
function formatTimeBlock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Функция для запуска таймера блокировки
function startBlockTimer(username, duration, userState, timerElement) {
  let timeLeft = duration;
  let intervalId = null;
  let musicTriggered = false;

  // Начальное сообщение на таймере
  timerElement.textContent = "Click here to start timer";
  timerElement.style.cursor = 'pointer';
  timerElement.classList.add('pulse-timer');

  // Обработчик клика
  const handleClick = () => {
    if (musicTriggered) return; // защита от повторного запуска
    musicTriggered = true;

    playSpecialMusic(); // запускаем музыку

    // Показываем сразу первый тик
    timerElement.textContent = formatTimeBlock(timeLeft);
    timerElement.classList.remove('pulse-timer');
    timerElement.style.cursor = 'default';

    // Запускаем таймер только при клике
    intervalId = setInterval(() => {
      timeLeft--;
      timerElement.textContent = formatTimeBlock(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(intervalId);
        unblockUsername(username);
        blockStates.delete(username);
        try {
          localStorage.removeItem(`blockEndTime_${username}`);
        } catch (err) {
          console.error(`Failed to remove blockEndTime from localStorage for ${username}: ${err.message}`);
        }
      }
    }, 1000);
    userState.timerInterval = intervalId;
  };

  // Удаляем старый обработчик, если он есть
  timerElement.removeEventListener('click', userState.clickHandler);
  // Сохраняем новый обработчик
  userState.clickHandler = handleClick;
  // Вешаем новый обработчик
  timerElement.addEventListener('click', handleClick);

  blockStates.set(username, userState);
}

// Функция для блокировки пользователя
function blockUser(username, duration) {
  stopSpecialMusic();
  if (!Number.isInteger(duration) || duration <= 0) {
    console.log(`Invalid duration: ${duration}. Duration must be a positive integer.`);
    return;
  }

  const currentUser = getCurrentUser();
  if (username !== currentUser) return;

  const userState = blockStates.get(username) || {
    isBlocked: false,
    timerInterval: null,
    blockEndTime: null,
    clickHandler: null
  };

  // Очищаем существующий таймер, если он есть
  if (userState.timerInterval) {
    clearInterval(userState.timerInterval);
    userState.timerInterval = null;
  }

  // Показываем экран блокировки
  blockScreen.classList.remove('hidden');
  blockScreen.classList.add('visible');

  const warningText = `${username} has violated the rules. ChatGPT ishlatmoqchimiding.
This behavior is strictly prohibited. 
You are now temporarily blocked. 
Further violations will result in a permanent ban.`;

  // Устанавливаем новое время окончания блокировки
  const blockEndTime = Date.now() + duration * 1000;
  userState.isBlocked = true;
  userState.blockEndTime = blockEndTime;

  try {
    localStorage.setItem(`blockEndTime_${username}`, blockEndTime);
  } catch (err) {
    console.error(`Failed to save blockEndTime for ${username}: ${err.message}`);
  }

  // Блокируем взаимодействие
  document.body.style.pointerEvents = 'none';

  // Озвучиваем предупреждение и затем настраиваем таймер
  speak(warningText, () => {
    startBlockTimer(username, duration, userState, timerElement);
  });

  blockStates.set(username, userState);
}




const blockScreen = document.getElementById("block-screen");
const timerElement = document.getElementById("timer");
let isBlocked = false; // Флаг блокировки

function unblockUsername(username) {
  const userState = blockStates.get(username);
  if (!userState || !userState.isBlocked) {
    console.log(`User ${username} is not blocked.`);
    return;
  }

  // Очищаем таймер, если он активен
  if (userState.timerInterval) {
    clearInterval(userState.timerInterval);
    userState.timerInterval = null;
  }

  // Сбрасываем состояние блокировки
  userState.isBlocked = false;
  blockStates.set(username, userState);

  // Восстанавливаем взаимодействие с элементами
  document.body.style.pointerEvents = 'auto';

  // Удаляем данные из localStorage
  localStorage.removeItem(`blockEndTime_${username}`);
  stopSpecialMusic();

  // Скрываем экран блокировки
  blockScreen.classList.remove("visible");
  messageTimestamps = []; // Сбрасываем историю сообщений
  timerElement.textContent = ''; // Сбрасываем отображение таймера

  // Удаляем состояние пользователя из Map
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


document.getElementById('upload-file-input').addEventListener('change', async function (e) {
  // 🚫 Проверка статуса аккаунта
  if (typeof accountStatus !== 'undefined' && accountStatus === 'Debtor') {
    showToastNotification("You cannot upload files while your account is in debt.", 'error');
    e.target.value = ""; // сбрасываем выбранный файл
    return;
  }

  const file = e.target.files[0];
  if (!file) return;

  const uploadBox = document.querySelector('.upload-info');
  uploadBox.classList.add('disabled');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/upload-section', {
      method: 'POST',
      body: formData
    });

    const result = await res.json();

    if (res.ok) {
      showToastNotification(result.message || "File uploaded successfully!", 'success');
    } else {
      showToastNotification(result.error || "Upload failed", 'error');
    }
  } catch (err) {
    showToastNotification("An error occurred during upload.", 'error');
  } finally {
    uploadBox.classList.remove('disabled');
    e.target.value = ""; // очистить выбранный файл
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
  '/static/music/Masha.mp3',
  '/static/music/JAVA - Gaz yoq.mp3',
  '/static/music/Argus.mp3',
];

let currentTrackIndex = 0;

// 🔁 Функция для запуска бесконечного плейлиста
async function playNextTrack() {
  stopSpecialMusic(); // остановим предыдущую, если была

  if (!audioContext) audioContext = new AudioContext();

  try {
    const trackUrl = tracks[currentTrackIndex];
    const response = await fetch(trackUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0; // 100% громкость

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(gainNode).connect(audioContext.destination);

    sourceNode.start();
    isMusicPlaying = true;

    console.log(`🎵 Now playing: ${trackUrl}`);

    sourceNode.onended = () => {
      currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
      playNextTrack(); // запускаем следующий
    };

  } catch (err) {
    console.error('❌ Failed to play track:', err);
  }
}

// 🔈 Основная функция, которую ты вызываешь
function playSpecialMusic() {
  if (isMusicPlaying) return; // уже играет — не запускаем заново
  playNextTrack();
}

// ⛔ Остановка музыки
function stopSpecialMusic() {
  if (sourceNode) {
    try {
      sourceNode.onended = null; // ❗ отключаем автозапуск следующего трека
      sourceNode.stop();
      sourceNode.disconnect();
    } catch (e) {
      console.warn("⚠️ Already stopped or failed to stop source");
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
  
const spinSfx = new Audio('/static/music/Bang Bang starter audio.mp3');
const winSfx = new Audio('/static/music/Coins_Rewarded.mp3');
const ballSfx = new Audio('/static/sfx/ball.mp3');

function saveBoxStateLocally(data) {
  localStorage.setItem('lucky_spin_state', JSON.stringify(data));
}

function loadBoxStateLocally() {
  try {
    return JSON.parse(localStorage.getItem('lucky_spin_state')) || null;
  } catch {
    return null;
  }
}

function renderBoxState(state) {
  ['A', 'B', 'C'].forEach(box => {
    const container = document.querySelector(`#box-${box} .balls`);
    const boxEl = document.getElementById(`box-${box}`);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < (state.current_boxes[box] || 0); i++) {
      const ball = document.createElement('img');
      ball.classList.add('ball');
      ball.src = '/static/icons/ball.png';
      container.appendChild(ball);
    }
    boxEl.classList.toggle('LuckyBox', state.winning_box === box);
  });

  const spinCounter = document.getElementById("spin-counter");
  if (spinCounter) {
    spinCounter.textContent = `Spins: ${state.spin_count} / 10`;
  }
}

async function preloadBoxState(username) {
  const res = await fetch(`/api/lucky_progress?username=${username}`);
  const data = await res.json();
  saveBoxStateLocally(data);
  renderBoxState(data);
}

function saveRewardHistory(entry) {
  const history = loadRewardHistory();
  history.unshift(entry);
  if (history.length > 20) history.pop();
  localStorage.setItem("lucky_spin_history", JSON.stringify(history));
}

function loadRewardHistory() {
  try {
    return JSON.parse(localStorage.getItem("lucky_spin_history")) || [];
  } catch {
    return [];
  }
}

function renderRewardHistory() {
  const history = loadRewardHistory();
  const list = document.getElementById("history-list");
  if (!list) return;
  list.innerHTML = "";

  history.forEach(entry => {
    const li = document.createElement("li");
    if (entry.type === "LuckyBox") {
      li.textContent = `🎉 ${entry.time}: Lucky Box ${entry.amount} pts from box ${entry.box}`;
    } else if (entry.type === "Ball") {
      li.textContent = `🎯 ${entry.time}: Ball in box ${entry.box}`;
    } else if (entry.type === "Small Win") {
      li.textContent = `💰 ${entry.time}: Won ${entry.amount} pts`;
    } else {
      li.textContent = `❌ ${entry.time}: Nothing`;
    }
    list.appendChild(li);
  });
}

function formatTime(ts = Date.now()) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const saved = loadBoxStateLocally();
  if (saved) renderBoxState(saved);
  if (typeof currentUser !== 'undefined') {
    preloadBoxState(currentUser);
  }
  renderRewardHistory();
});

document.getElementById("luckySpinBtn").addEventListener("click", async () => {
  const btn = document.getElementById("luckySpinBtn");
  try {
    btn.disabled = true;
    btn.classList.add('spinning');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Spinning...`;
    spinSfx.play();

    const res = await fetch('/api/lucky_event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser })
    });

    const data = await res.json();
    saveBoxStateLocally(data);
    renderBoxState(data);

    const now = formatTime();

    // Обновление баланса
    const balanceElement = document.getElementById("balance");
    if (balanceElement && data.new_balance !== undefined) {
      balanceElement.textContent = `${data.new_balance.toFixed(0)} pts`;
    }

    // Эффекты
    if (data.won > 0 && data.winning_box) {
      winSfx.play();
      showModalStatus(`🎉 You won ${data.won} points from box ${data.winning_box}!`, "success");

      saveRewardHistory({
        type: "LuckyBox",
        time: now,
        amount: data.won,
        box: data.winning_box
      });

    } else if (data.got_ball && data.ball_box) {
      const container = document.querySelector(`#box-${data.ball_box} .balls`);
      const falling = document.createElement('img');
      falling.src = '/static/icons/ball.png';
      falling.className = 'ball-falling';
      container.appendChild(falling);
      ballSfx.play();

      setTimeout(() => {
        container.removeChild(falling);
        const ball = document.createElement('img');
        ball.src = '/static/icons/ball.png';
        ball.className = 'ball';
        container.appendChild(ball);
      }, 600);

      showModalStatus("🎯 You got a ball!", "success");

      saveRewardHistory({
        type: "Ball",
        time: now,
        box: data.ball_box
      });

    } else if (data.won > 0) {
      winSfx.play();
      showModalStatus(`💰 You won ${data.won} points!`, "success");

      saveRewardHistory({
        type: "Small Win",
        time: now,
        amount: data.won
      });

    } else {
      showModalStatus("❌ No reward this time.", "neutral");
      saveRewardHistory({
        type: "Nothing",
        time: now
      });
    }

    renderRewardHistory();

  } catch (err) {
    console.error("Lucky spin error:", err);
    showModalStatus("Something went wrong!", "failed");
  } finally {
    btn.disabled = false;
    btn.classList.remove('spinning');
    btn.innerHTML = `<i class="fas fa-magic"></i> Spin Now`;
  }
});

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
/*
Event
*/

function initExamSecurity(enable = true) {

    if (enable) {
		showModalStatus("Tizim anti-cheating ishga tushirdi");
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('mouseenter', handleMouseEnter);
        document.addEventListener('copy', onCopy);
        document.addEventListener('paste', onPaste);
        document.addEventListener('contextmenu', onContextMenu);
    } else {
		showToastNotification("Tizim anti-cheating ochirdi");
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('mouseenter', handleMouseEnter);
        document.removeEventListener('copy', onCopy);
        document.removeEventListener('paste', onPaste);
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
const maxViolations = 1;

function incrementViolation(reason = "Violation") {
	  // ГОЛОСОВОЕ ПРЕДУПРЕЖДЕНИЕ → запуск музыки по завершении речи
  const warningText = `${username} has violated the rules. ChatGPT ishlatmoqchimiding.
This behavior is strictly prohibited. 
You are now temporarily blocked. 
Further violations will result in a permanent ban.`;

  speak(warningText, () => {
    
  });
    violationCount++;
    showToastNotification(`${reason}: ${violationCount}/${maxViolations}`,'info');
    if (violationCount >= maxViolations) {
        blockUser(currentUser, 900);
        violationCount = 0;
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