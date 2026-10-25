/**
 * Polling bot for the Emporium Telegram Mini App.
 *
 * - Private chat: replies with a reply-keyboard web_app
 *   button that opens the game. Only keyboard-button
 *   launches let the Mini App send data back via
 *   WebApp.sendData.
 * - Receives web_app_data service messages (logs sent
 *   from the Mini App) and appends them to
 *   logs/mini-app-<chat_id>.jsonl.
 * - Imports photos into public/portraits/<regionFolder>/<sex>
 *   as WebP and updates PORTRAIT_COUNTS:
 *     · photos sent to the bot in private chat
 *     · /import (or /импорт) as a REPLY to a photo post
 *       in a group — imports that post's photos (whole
 *       album when the post is part of one)
 *   Both paths require a one-time /consent confirmation
 *   that the sender has the rights to the photos.
 *
 * Group import requires the bot to be a group member with
 * privacy mode disabled (BotFather > Group Privacy > Disable)
 * or admin rights.
 *
 * Env:
 *   TG_TOKEN    — bot token (required)
 *   MINI_APP_URL— Web App URL (required)
 *   LOG_DIR     — directory for received logs (default: logs)
 */

import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import {
  importPortraitBuffer,
  listPortraitCounts
} from './portraitImporter.mjs';

const TOKEN = process.env.TG_TOKEN;
const APP_URL = process.env.MINI_APP_URL || null;
const LOG_DIR = process.env.LOG_DIR || 'logs';
const TARGET_FILE = join('tools', 'portrait-target.json');
const CONSENT_FILE = join('tools', 'consent.json');

if (!TOKEN) {
  console.error('TG_TOKEN env var is required');
  process.exit(1);
}

mkdirSync(LOG_DIR, { recursive: true });

const API = `https://api.telegram.org/bot${TOKEN}`;
let offset = 0;

/** chatId -> recent photo messages, for album (media_group) imports. */
const albumCache = new Map();
const ALBUM_CACHE_MAX = 200;

async function api(method, params = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, timeout: 30 })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
}

function loadJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function loadTarget() {
  return loadJson(TARGET_FILE, null);
}

function saveTarget(target) {
  writeFileSync(TARGET_FILE, JSON.stringify(target, null, 2));
}

function hasConsent(chatId) {
  return loadJson(CONSENT_FILE, {})[String(chatId)] === true;
}

function giveConsent(chatId) {
  const data = loadJson(CONSENT_FILE, {});
  data[String(chatId)] = true;
  writeFileSync(CONSENT_FILE, JSON.stringify(data, null, 2));
}

async function downloadPhoto(fileId) {
  const file = await api('getFile', { file_id: fileId });
  const res = await fetch(
    `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`
  );
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function largestPhotoSize(message) {
  const sizes = message.photo || [];
  return sizes.length > 0 ? sizes[sizes.length - 1] : null;
}

/** Collects file ids of a post's photos, including album siblings. */
function collectPostPhotoIds(chatId, replied) {
  const ids = [];
  const size = largestPhotoSize(replied);
  if (size) ids.push(size.file_id);
  if (replied.media_group_id) {
    const cache = albumCache.get(chatId) || [];
    for (const entry of cache) {
      if (
        entry.media_group_id === replied.media_group_id &&
        !ids.includes(entry.file_id)
      ) {
        ids.push(entry.file_id);
      }
    }
  }
  return ids;
}

async function importPhotoIds(chatId, fileIds) {
  const target = loadTarget();
  if (!target) {
    await api('sendMessage', {
      chat_id: chatId,
      text: 'Сначала выберите цель: /target <папка> <men|women|trans>\nНапример: /target 03_western_europe_nordics women\nСписок папок: /regions'
    });
    return;
  }

  const imported = [];
  const errors = [];
  for (const fileId of fileIds) {
    try {
      const buffer = await downloadPhoto(fileId);
      const { fileName, total } = await importPortraitBuffer(buffer, {
        regionFolder: target.regionFolder,
        sex: target.sex
      });
      imported.push(`${fileName} (всего ${total})`);
      console.log(`Imported ${fileName} -> ${target.regionFolder}/${target.sex}`);
    } catch (err) {
      errors.push(err.message);
      console.error(`Import failed: ${err.message}`);
    }
  }

  const parts = [];
  if (imported.length > 0) {
    parts.push(`Импортировано ${imported.length} фото:\n${imported.join('\n')}`);
  }
  if (errors.length > 0) {
    parts.push(`Ошибок: ${errors.length}\n${errors.join('\n')}`);
  }
  await api('sendMessage', {
    chat_id: chatId,
    text: parts.join('\n\n') || 'Нечего импортировать'
  });
}

async function handleCommand(chatId, text, message) {
  const [command, ...args] = text.split(/\s+/);

  if (command === '/consent') {
    giveConsent(chatId);
    await api('sendMessage', {
      chat_id: chatId,
      text:
        'Подтверждение принято. Вы подтверждаете, что имеете права на все фото, отправляемые боту (согласие изображённых лиц или владение правами). Импорт включён.'
    });
    return true;
  }

  if (command === '/target') {
    const [regionFolder, sex] = args;
    if (!regionFolder || !['men', 'women', 'trans'].includes(sex)) {
      await api('sendMessage', {
        chat_id: chatId,
        text: 'Использование: /target <папка> <men|women|trans>\nНапример: /target 03_western_europe_nordics women'
      });
      return true;
    }
    saveTarget({ regionFolder, sex });
    await api('sendMessage', {
      chat_id: chatId,
      text: `Цель установлена: ${regionFolder}/${sex}. Теперь присылайте фото — они будут сконвертированы в WebP и добавлены в портреты.`
    });
    return true;
  }

  if (command === '/regions') {
    const counts = listPortraitCounts();
    const lines = Object.entries(counts).map(
      ([folder, sexCounts]) =>
        `${folder}: ${Object.entries(sexCounts)
          .map(([sex, count]) => `${sex} ${count}`)
          .join(', ')}`
    );
    await api('sendMessage', {
      chat_id: chatId,
      text: `Папки портретов:\n${lines.join('\n')}`
    });
    return true;
  }

  if (command === '/import' || command === '/импорт') {
    if (!hasConsent(chatId)) {
      await api('sendMessage', {
        chat_id: chatId,
        text: 'Перед импортом подтвердите права на фото: /consent'
      });
      return true;
    }
    const replied = message.reply_to_message;
    if (!replied) {
      await api('sendMessage', {
        chat_id: chatId,
        text: 'Ответьте этой командой на пост с фото — фото из поста будут импортированы в портреты.'
      });
      return true;
    }
    const fileIds = collectPostPhotoIds(chatId, replied);
    if (fileIds.length === 0) {
      await api('sendMessage', {
        chat_id: chatId,
        text: 'В этом посте нет фото.'
      });
      return true;
    }
    await importPhotoIds(chatId, fileIds);
    return true;
  }

  return false;
}

console.log(`Bot running${APP_URL ? `, Web App URL: ${APP_URL}` : ' (import-only mode)'}`);
console.log(`Logs directory: ${LOG_DIR}`);

for (;;) {
  try {
    const updates = await api('getUpdates', {
      offset,
      allowed_updates: ['message']
    });
    for (const update of updates) {
      offset = update.update_id + 1;
      const message = update.message;
      if (!message) continue;
      const chatId = message.chat.id;
      const isPrivate = message.chat.type === 'private';

      if (message.web_app_data) {
        const data = message.web_app_data.data || '';
        const stamp = new Date().toISOString();
        const file = join(LOG_DIR, `mini-app-${chatId}.jsonl`);
        appendFileSync(
          file,
          JSON.stringify({
            stamp,
            chatId,
            button: message.web_app_data.button_text,
            data
          }) + '\n'
        );
        console.log(
          `[${stamp}] logs from chat ${chatId} (${data.length} bytes) -> ${file}`
        );
        await api('sendMessage', {
          chat_id: chatId,
          text: `Логи получены: ${data.length} байт. Сохранены в ${file}`
        });
        continue;
      }

      // Cache album photos so /import can grab the whole album.
      if (message.photo && message.media_group_id) {
        const size = largestPhotoSize(message);
        if (size) {
          const cache = albumCache.get(chatId) || [];
          cache.push({ file_id: size.file_id, media_group_id: message.media_group_id });
          if (cache.length > ALBUM_CACHE_MAX) cache.shift();
          albumCache.set(chatId, cache);
        }
      }

      if (message.photo && isPrivate) {
        if (!hasConsent(chatId)) {
          await api('sendMessage', {
            chat_id: chatId,
            text: 'Перед импортом подтвердите права на фото: /consent'
          });
          continue;
        }
        const size = largestPhotoSize(message);
        if (size) await importPhotoIds(chatId, [size.file_id]);
        continue;
      }

      if (message.text?.startsWith('/')) {
        const handled = await handleCommand(chatId, message.text, message);
        if (handled) continue;
      }

      // Game keyboard only in private chats — never spam groups.
      if (isPrivate && APP_URL) {
        await api('sendMessage', {
          chat_id: chatId,
          text: 'Эмпориум: нажмите кнопку ниже. Логи отправляются кнопкой «Logs» в углу приложения.',
          reply_markup: {
            reply_keyboard: [[{ text: 'Играть', web_app: { url: APP_URL } }]],
            resize_keyboard: true
          }
        });
        console.log(`Web App keyboard sent to chat ${chatId}`);
      }
    }
  } catch (err) {
    console.error(err.message);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
