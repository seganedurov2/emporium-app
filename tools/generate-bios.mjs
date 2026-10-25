#!/usr/bin/env node
/**
 * AI Bio Generation Pipeline
 * Generates dark, syndicate-style dossiers for characters using a local Ollama LLM.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BIOS_PATH = path.join(ROOT, "public", "portraits", "bios.json");
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3";

async function generateBio(char, model) {
  const quality = char.skill > 70 ? "элитный специалист" : char.skill > 40 ? "опытный кадр" : "низкоквалифицированный персонал";
  const submissionText = char.submission > 70 ? "полностью сломлен(а) и покорна" : char.submission > 40 ? "проявляет умеренное сопротивление" : "крайне строптив(а) и агрессивна";
  
  const prompt = `Напиши мрачное, лаконичное досье в стиле криминального синдиката для персонажа.
Параметры:
- Гендер: ${char.gender}
- Регион: ${char.regionName || char.region}
- Квалификация: ${quality} (Skill: ${char.skill})
- Покорность: ${submissionText} (Submission: ${char.submission})
- Роль: ${char.role}

Опиши в 2-3 предложениях: кем был этот человек до захвата и какую ценность/проблему он представляет сейчас для синдиката. 
Стиль: дарк-менеджмент, холодный профессионализм, никакой излишней сентиментальности.
Язык: Русский.`;

  try {
    const res = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    return data.response.trim();
  } catch (err) {
    console.error(`  Failed to generate bio for ${char.id}: ${err.message}`);
    return "Данные о биографии отсутствуют или засекречены.";
  }
}

async function main() {
  const model = process.argv[2] || DEFAULT_MODEL;
  console.log(`Starting bio generation using model: ${model}...`);

  // In a real scenario, we would load the current roster from the game state.
  // For this tool, we'll assume we're generating bios for a sample set or a provided JSON.
  // Since we don't have a 'roster.json', we will simulate a load from the gameEngine's logic.
  
  // NOTE: To make this fully operational, the user should pipe their current roster here.
  // For now, we implement the engine.
  
  const sampleCharacters = [
    { id: 'char_1', gender: 'women', regionName: 'Германия', skill: 85, submission: 30, role: 'Пойманная элита' },
    { id: 'char_2', gender: 'men', regionName: 'Нигерия', skill: 20, submission: 90, role: 'Пойманный головорез' },
  ];

  const bios = {};

  for (const char of sampleCharacters) {
    console.log(`Generating bio for ${char.id}...`);
    const bio = await generateBio(char, model);
    bios[char.id] = bio;
    // Avoid rate limiting local Ollama
    await new Promise(r => setTimeout(r, 500));
  }

  await writeFile(BIOS_PATH, JSON.stringify(bios, null, 2));
  console.log(`\\nSuccess! Bios saved to ${BIOS_PATH}`);
}

main().catch(console.error);
