/**
 * Event Engine for Pawn Pleasure
 * Handles random weekly events that affect the campaign state, roster, and finances.
 */

import type { CampaignState } from './gameEngine';
import { formatMoney } from './currency';

export type EventChoice = {
  text: string;
  effect: (state: CampaignState) => { newState: CampaignState; message: string };
};

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  requirements?: (state: CampaignState) => boolean;
  choices: EventChoice[];
}

/**
 * Database of potential random events.
 */
export const EVENT_DATABASE: GameEvent[] = [
  {
    id: 'escape_attempt',
    title: 'Попытка побега',
    description: 'Один из ваших наиболее строптивых персонажей попытался сбежать, используя самодельный ключ. Охрана перехватила его в коридоре.',
    requirements: (state) => state.roster.some(c => c.isSlave && c.submission < 40),
    choices: [
      {
        text: 'Применить суровое наказание (Повышает покорность, снижает здоровье)',
        effect: (state) => {
          const target = state.roster.find(c => c.isSlave && c.submission < 40)!;
          const newRoster = state.roster.map(c => 
            c.id === target.id 
              ? { ...c, submission: Math.min(100, c.submission + 15), exactHealth: Math.max(0, c.exactHealth - 20) } 
              : c
          );
          return { newState: { ...state, roster: newRoster }, message: 'Персонаж был жестоко наказан. Его воля сломлена, но здоровье ухудшилось.' };
        }
      },
      {
        text: 'Провести беседу и предложить бонусы (Повышает лояльность, стоит денег)',
        effect: (state) => {
          if (state.funds < 1000) return { newState: state, message: 'Недостаточно средств для подкупа.' };
          const target = state.roster.find(c => c.isSlave && c.submission < 40)!;
          const newRoster = state.roster.map(c => 
            c.id === target.id ? { ...c, loyalty: Math.min(100, c.loyalty + 20) } : c
          );
          return { newState: { ...state, funds: state.funds - 1000, roster: newRoster }, message: 'Вы потратили $1,000 на поощрения. Лояльность персонажа выросла.' };
        }
      }
    ]
  },
  {
    id: 'secret_collector',
    title: 'Секретный Коллекционер',
    description: 'Анонимный покупатель из премиум-региона прислал предложение: он готов выкупить вашего самого красивого персонажа за тройную цену, но требует полной конфиденциальности.',
    requirements: (state) => state.roster.length > 0,
    choices: [
      {
        text: 'Согласиться на сделку (Много денег, удар по репутации)',
        effect: (state) => {
          const target = state.roster[0]; // In real logic, pick highest attractiveness
          const price = target.price * 3;
          const newRoster = state.roster.filter(c => c.id !== target.id);
          return { 
            newState: { ...state, funds: state.funds + price, reputation: Math.max(0, state.reputation - 20), roster: newRoster }, 
            message: `Вы продали ${target.name} за ${formatMoney(price)}. Репутация синдиката пострадала из-за секретности сделки.` 
          };
        }
      },
      {
        text: 'Отказать (Сохранить актив)',
        effect: (state) => ({ newState: state, message: 'Вы отказались от сделки, сохранив ценного персонажа в ростере.' })
      }
    ]
  },
  {
    id: 'inspector_visit',
    title: 'Внезапная проверка',
    description: 'В ваше заведение прибыл инспектор из местного управления. Он проверяет условия содержания и документы.',
    choices: [
      {
        text: 'Попытаться дать взятку ($5,000)',
        effect: (state) => {
          if (state.funds < 5000) return { newState: state, message: 'Денег на взятку не хватило!' };
          return { newState: { ...state, funds: state.funds - 5000 }, message: 'Инспектор принял деньги и закрыл глаза на все нарушения.' };
        }
      },
      {
        text: 'Надеяться на чистоту документов',
        effect: (state) => {
          const success = Math.random() > 0.5;
          if (success) return { newState: state, message: 'Инспектор не нашел ничего подозрительного. Вам повезло.' };
          return { newState: { ...state, funds: state.funds - 15000, reputation: Math.max(0, state.reputation - 10) }, message: 'Проверка провалилась! Вы заплатили огромный штраф и потеряли репутацию.' };
        }
      }
    ]
  }
];

/**
 * Rolls for a random event based on probability.
 */
export function rollWeeklyEvent(state: CampaignState): GameEvent | null {
  if (Math.random() > 0.3) return null; // 30% chance of an event per week

  const eligibleEvents = EVENT_DATABASE.filter(e => !e.requirements || e.requirements(state));
  if (eligibleEvents.length === 0) return null;

  return eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
}

/**
 * Applies the choice of an event to the campaign state.
 */
export function resolveEventChoice(state: CampaignState, eventId: string, choiceIndex: number): { newState: CampaignState; message: string } {
  const event = EVENT_DATABASE.find(e => e.id === eventId);
  if (!event) throw new Error("Event not found");
  
  const choice = event.choices[choiceIndex];
  if (!choice) throw new Error("Choice index out of range");

  return choice.effect(state);
}
