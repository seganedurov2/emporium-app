/**
 * The weekly cycle of the campaign, lifted out of App.tsx.
 *
 * `advanceWeek` used to be one ~930-line handler inside the App component: it
 * mixed venue revenue, the beauty salon, caravans, capture operations, the VIP
 * and slave contracts, the hospital, the psychologist, bankruptcy, the city
 * economy and the meta-progress, and ended by calling four React setters.
 *
 * `advanceCampaignWeek(state, deps)` now computes the whole week in one go and
 * returns it as a value: the next campaign state, the log lines, the event to
 * open, the achievement toast, the ending and the records to store. The
 * component only feeds it and writes the result back.
 *
 * The order of operations and the arithmetic are unchanged, so a save written
 * before the split keeps loading and the weekly result stays identical. The
 * save format is untouched: the same fields are written with the same values.
 *
 * `deps` carries what the component owns: the raid queue (to cap the ambushes
 * rolled this week), the hospital staff numbers the component derives from its
 * building preview, the records board and the notification sinks.
 */

import type { Caravan, Character, WeeklyFinanceReport } from './gameEngine';
import { generateSlaveCharacter } from './gameEngine';
import type { ManagedCampaignState } from './saveState';
import type { AuctionLot } from './auctionHouseEngine';
import { createGoodsLot, getAuctionHouseStaff, AUCTION_INSPECTION_BALANCE } from './auctionHouseEngine';
import type { ScheduledTreatment } from './beautySalonEngine';
import type { StandingMap } from './slaveContractsEngine';
import type { CaptureOperation } from './captureOpsEngine';
import { formatMoney } from './currency';
import { prestigeRevenueMultiplier } from './metaProgressEngine';
import { calculateVenueSynergies, type SynergyResult } from './synergyEngine';
import { calculateBuildingWeeklyEffects } from './buildingsEngine';
import { getRandomEventWithAuction, type GameEvent } from './eventsEngine';
import { chooseExpansionEvent } from './expansionEventsEngine';
import { ACHIEVEMENT_BY_ID, evaluateAchievements } from './metaProgressEngine';
import { calculateAttractiveness } from './gameEngine';
import { advanceBankruptcyWeek } from './bankruptcyEngine';
import { advanceHospitalWeek, type HospitalStaffEffects } from './hospitalEngine';
import { advanceEmployeesWeek, ensureEmployeeCandidatesForVacancies, hiringSlotUpkeep, refreshEmployeeCandidates, getVacantSpecialties } from './employeesEngine';
import { advanceRestZoneWeek, recommendedAttendantCount, restZoneWeeklyUpkeep } from './restZoneEngine';
import { advancePsychologistWeek } from './psychologistEngine';
import { advancePregnancyWeek } from './pregnancyEngine';
import { advanceCityEconomy } from './cityEconomyEngine';
import { withCityEconomyReport } from './cityEconomyState';
import { advanceCampaignScript, createCampaignScript, getCampaignActMilestones, type ScriptSnapshot } from './campaignScript';
import { applyWeeklyMetaProgress, recordFinishedWeek } from './campaignGoalAdvance';
import { generateVenueRequests } from './administratorEngine';
import { generateMarketImprovementRequest, marketImprovementEffects } from './marketImprovementsEngine';
import { triggerWeeklyMarketRefresh } from './marketRefreshLogic';
import {
  applyBdsmTraining,
  assessSlaveUnrest,
  detectCaravanSupplyTriggers,
  generateSlaveContract,
  generateTradeSupplyContract,
  getStanding,
  isBuyerLocked,
  maxOrdersForStanding,
  rollSlaveEscapes,
  type CaptiveLotOffer,
  type SlaveBuyerContract,
  type SlaveContractChannel,
  type TradeSupplyContract
} from './slaveContractsEngine';
import { generateContract, type ClientContract } from './contractsEngine';
import {
  pleasureHouseExhaustionBump,
  pleasureHouseRevenueMultiplier
} from './pleasureHouseEngine';
import { stripClubExhaustionBump, stripClubRevenueMultiplier } from './stripClubEngine';
import { MANAGER_TRAITS, TREATMENTS } from './beautySalonEngine';
import { weeklyHealthWear } from './exhaustionEngine';
import { warehouseWeeklyUpkeep } from './warehouseEngine';
import { advanceBoilerHouseWeek, HEATED_VENUES } from './boilerHouseEngine';
import { applyClinicRecovery, healthFromExact } from './buildingsEngine';
import { clearCaptureTask, isOnCaptureOp, resolveCaptureArrival } from './captureOpsEngine';
import { trySpawnCaptureRaid } from './caravanRaidsEngine';
import { dangerForRegion, regionNameToId, trySpawnRaid, type ActiveRaid } from './caravanRaidsEngine';
import type { GameRecords, LeaderboardEntry } from './metaProgressEngine';
import { worksVenue } from './rosterSort';

/** Notifications the component owns: the toast and the hospital ledger. */
export interface WeeklyNotifyDeps {
  /** In-app toast, also used for the loan and bankruptcy milestones. */
  showNotify: (message: string) => void;
  /** Hospital ledger line for every admission. */
  pushHospitalNotice: (message: string) => void;
}

/** Everything the weekly cycle reads from the component rather than the save. */
export interface WeeklyDeps extends WeeklyNotifyDeps {
  /** Average fatigue an operative sheds per week while left «без работы». */
  offDutyExhaustionRecovery: number;
  /** Ambushes already waiting in the modal stack; new ones are capped. */
  queuedRaids: number;
  maxQueuedRaids: number;
  hospitalLevel: number;
  hospitalStaff: HospitalStaffEffects;
  hospitalPsychologistsOnDuty: Parameters<typeof advancePsychologistWeek>[0]['psychologists'];
  /** Local records board and leaderboard, persisted outside the campaign save. */
  gameRecords: GameRecords;
  leaderboard: LeaderboardEntry[];
}

const HEALTH_LABELS: Record<Character['healthLevel'], string> = {
  Pristine: 'Отличное',
  Good: 'Хорошее',
  Fair: 'Среднее',
  Poor: 'Плохое',
  Critical: 'Критическое'
};

const EXHAUSTION_LABELS: Record<Character['exhaustionLevel'], string> = {
  Rested: 'Отдохнувший',
  Tired: 'Уставший',
  Exhausted: 'Истощён',
  'Burned Out': 'Выгоревший'
};

const rollChance = (probability: number) => Math.random() < probability;

/** The pure result of one week: what the player sees and what must be stored. */
export interface WeeklyAdvance {
  nextState: ManagedCampaignState;
  logs: string[];
  /** Week that just began, for the caller's log lines. */
  weekNumber: number;
  /** The toast the caller shows once the state is written. */
  notify: string;
  /** Title of the first achievement unlocked this week, if any. */
  achievementNotify: string | null;
  /** Set when this week ended the campaign. */
  ending: { type: 'victory' | 'defeat'; week: number } | null;
  gameRecords: GameRecords;
  leaderboard: LeaderboardEntry[];
  /** True when the campaign goal was reached this week. */
  campaignEnded: boolean;
  /** The event to open this week, or null. */
  scheduledEvent: GameEvent | null;
  /** Ambushes rolled this week, to be queued by the caller. */
  pendingRaids: ActiveRaid[];
  netIncome: number;
  loanPayment: number;
}

/**
 * Rolls the event of the week: ambushes win over everything, then on each
 * fourth week the auction is kept, otherwise a 35% chance opens an expansion
 * event (65%) or a random event.
 */
function pickWeeklyEvent(state: ManagedCampaignState, funds: number): GameEvent | null {
  if (!rollChance(0.35)) return null;
  if (state.week % 4 === 0) return getRandomEventWithAuction(state.week);
  const expansionEvent = chooseExpansionEvent({
    week: state.week,
    funds,
    employees: state.employees,
    auxiliaryBuildings: state.auxiliaryBuildings
  }, state.seenExpansionEventIds);
  if (expansionEvent && rollChance(0.65)) return expansionEvent as unknown as GameEvent;
  return getRandomEventWithAuction(state.week);
}

export function advanceCampaignWeek(state: ManagedCampaignState, deps: WeeklyDeps): WeeklyAdvance {
  const gameState = state;
  let currentFunds = gameState.funds;
  const buildingEffects = calculateBuildingWeeklyEffects(gameState.auxiliaryBuildings, gameState.employees);
  const employeeWeek = advanceEmployeesWeek(gameState.employees, buildingEffects, gameState.week);

// Patients occupy a bed for the whole stay, including recovery, so they earn
    // nothing from their venue while they are on the ward.
    const hospitalPatientIds = new Set((gameState.hospital.patients || []).map(patient => patient.characterId));

    // Operatives on a rest program are away from every venue until they return.
    const restingIds = new Set((gameState.restZone?.placements || []).map(placement => placement.characterId));

    // Venue-specific revenues & Pleasure House intimate stats increment
    let venueRevenue = 0;

    // Calculate synergies for each venue once per week
    const venueSynergies: Record<string, SynergyResult> = {};
    const venues = ['beauty_salon', 'strip_club', 'pleasure_house', 'trade', 'security', 'auction_house', 'bdsm_room'];
    for (const v of venues) {
      const staff = gameState.roster.filter(c => c.assignedVenue === v);
      venueSynergies[v] = calculateVenueSynergies(staff);
    }

    // Котельная: котлы сжигают топливо и дают тепло площадкам. Покрытие
    // потребности задаёт бонус к выручке и прибавку к усталости персонала.
    const activeHeatedVenues = HEATED_VENUES.filter(venue =>
      gameState.roster.some(c => c.assignedVenue === venue && !isOnCaptureOp(c) && !hospitalPatientIds.has(c.id) && !restingIds.has(c.id))
    ).length;
    const boilerWeek = advanceBoilerHouseWeek({
      state: gameState.boilerHouse,
      week: gameState.week + 1,
      activeVenues: activeHeatedVenues,
      // Автоматика тратит только то, что есть в казне на начало недели.
      funds: currentFunds
    });
    const boilerReport = boilerWeek.report;
    // Автозакупка топлива и авторемонт списываются сразу, до прочих расходов.
    if (boilerReport.autoSpent > 0) {
      currentFunds -= boilerReport.autoSpent;
    }

    const updatedRosterVenues = gameState.roster.map(c => {

      if (c.pregnancy?.status === 'hospitalized') return c;
      // Operatives deployed on a capture operation are away from every venue.
if (isOnCaptureOp(c) || hospitalPatientIds.has(c.id) || restingIds.has(c.id)) return c;
      // Operatives kept «без работы» stay on payroll but generate nothing.
      if (c.assignedVenue === 'unassigned') return c;
      const attr = calculateAttractiveness(c);
      if (c.assignedVenue === 'beauty_salon') {
        const synergies = venueSynergies['beauty_salon'];
        const rev = Math.floor((c.skill * 55 + attr * 20) * synergies.totalRevenueMultiplier);
        venueRevenue += rev;
        return c;
      } else if (c.assignedVenue === 'strip_club') {
        const scMultiplier = stripClubRevenueMultiplier(gameState.stripClubUpgrades);
        const synergies = venueSynergies['strip_club'];
        const rev = Math.floor((c.skill * 65 + attr * 35) * scMultiplier * synergies.totalRevenueMultiplier);
        venueRevenue += rev;
        return c;
      } else if (c.assignedVenue === 'pleasure_house') {
        const phMultiplier = pleasureHouseRevenueMultiplier(gameState.pleasureHouseUpgrades);
        const synergies = venueSynergies['pleasure_house'];
        const rev = Math.floor((c.skill * 80 + attr * 50) * phMultiplier * synergies.totalRevenueMultiplier);
        venueRevenue += rev;
        // Increment vaginal & anal counts based on skill and submission
        const subMult = (c.submission || 50) / 50;
        const addVag = Math.floor((Math.random() * 4 + 2) * subMult);
        const addAnal = Math.floor((Math.random() * 3 + 1) * subMult);
        const newVag = (c.pleasureStats?.vaginalCount || 0) + addVag;
        const newAnal = (c.pleasureStats?.analCount || 0) + addAnal;
        const newEarnings = (c.pleasureStats?.totalEarnings || 0) + rev;
        return {
          ...c,
          pleasureStats: { vaginalCount: newVag, analCount: newAnal, totalEarnings: newEarnings }
        };
      } else {
        const synergies = venueSynergies[c.assignedVenue || 'trade'];
        venueRevenue += Math.floor((c.skill * 45 + 5000) * synergies.totalRevenueMultiplier);
        return c;
      }
    });

    let caravanEarnings = 0;
    const updatedCaravans: Caravan[] = [];
    const newLogs: string[] = [];
    boilerReport.logs.forEach(line => newLogs.push(line));
    const newCaravanPrisoners: Character[] = [];
    const newGoodsLots: AuctionLot[] = [];

    // Ambushes that fired this week. Caravans roll once per week on the road and
    // capture operations roll harder still, so several can land in the same week.
    // Only as many as the modal stack can still hold are rolled.
    const pendingRaids: ActiveRaid[] = [];
    const raidSlots = Math.max(0, deps.maxQueuedRaids - deps.queuedRaids);

    // Process capture operations ("захват"): one week on the road — where the
    // squad can be ambushed — then the snatch itself is resolved on arrival.
    const captureFundsDelta = { total: 0 };
    const captureReputationDelta = { total: 0 };
    const seizedTargets: Character[] = [];
    const lostSquadIds = new Set<string>();
    const woundedSquadIds = new Set<string>();
    const updatedCaptureOps: CaptureOperation[] = [];

    (gameState.captureOperations || []).forEach(operation => {
      if (operation.status !== 'outbound') {
        updatedCaptureOps.push(operation);
        return;
      }
      const remaining = operation.weeksRemaining - 1;
      if (remaining > 0) {
        let raidFired = false;
        if (pendingRaids.length < raidSlots) {
          const squad = gameState.roster.filter(c => operation.squadIds.includes(c.id));
          const raid = trySpawnCaptureRaid({
            id: operation.id,
            codename: operation.codename,
            targetName: operation.targetName,
            targetRegionName: operation.targetRegionName,
            leaderName: operation.leaderName,
            leaderId: operation.leaderId,
            squad,
            squadAvgSkill: operation.squadAvgSkill,
            squadAvgLoyalty: operation.squadAvgLoyalty,
            bounty: operation.bounty
          }, buildingEffects.escortCrew, {
            riskReduction: buildingEffects.raidRiskReduction,
            victoryBonus: buildingEffects.raidVictoryBonus
    });
          if (raid) {
            raidFired = true;
            pendingRaids.push(raid);
            newLogs.push(`ЗАСАДА: отряд «${operation.codename}» перехвачен на пути в ${operation.targetRegionName} (${raid.enemyName}), цель — ${operation.targetName}.`);
          }
        }
        updatedCaptureOps.push({
          ...operation,
          weeksRemaining: remaining,
          raidsTriggered: operation.raidsTriggered + (raidFired ? 1 : 0)
    });
        return;
      }

      // Arrival: the squad moves on the target.
      const resolution = resolveCaptureArrival(operation);
      captureFundsDelta.total += resolution.fundsDelta;
      captureReputationDelta.total += resolution.reputationDelta;
      if (resolution.captured) {
        seizedTargets.push(resolution.captured);
        newLogs.push(`Из региона ${operation.targetRegionName} доставлен 1 пленник (${resolution.captured.name}) — обращён в дом удовольствия без работы.`);
      }
      resolution.squadLostIds.forEach(id => lostSquadIds.add(id));
      resolution.squadWoundedIds.forEach(id => woundedSquadIds.add(id));
      updatedCaptureOps.push({ ...operation, weeksRemaining: 0, status: resolution.status });
    });

    // Process caravans
    gameState.caravans.forEach(caravan => {
      if (caravan.status !== 'traveling') {
        updatedCaravans.push(caravan);
        return;
      }
      const remaining = caravan.weeksRemaining - 1;
      // A caravan is ambushed on every week it spends on the road (never on the
      // week it arrives).
      let raidFired = false;
      if (remaining > 0 && pendingRaids.length < raidSlots) {
        const leader = gameState.roster.find(c => (caravan.leaderId ? c.id === caravan.leaderId : c.name === caravan.leaderName));
        const crew = gameState.roster.filter(c => c.assignedVenue === 'trade'
          && c.id !== leader?.id
          && !isOnCaptureOp(c)
          && !restingIds.has(c.id));
        const raid = trySpawnRaid(caravan, leader, leader ? [leader, ...crew] : crew, buildingEffects.escortCrew, {
          riskReduction: buildingEffects.raidRiskReduction,
          victoryBonus: buildingEffects.raidVictoryBonus
    });
        if (raid) {
          raidFired = true;
          pendingRaids.push(raid);
          newLogs.push(`ЗАСАДА НА КАРАВАН: «${caravan.name}» атакован (${raid.enemyName}) на маршруте в ${caravan.destRegion}!`);
        }
      }
      // Weather, hunger or disease can claim a caravan on the road. This is
      // mutually exclusive with an ambush in the same week — a caravan that
      // survived an attack isn't also lost to the elements.
      if (remaining > 0 && !raidFired) {
        const destDanger = dangerForRegion(caravan.destRegion);
        if (Math.random() < destDanger * 0.15) {
          const lossCause = ['погодные условия', 'голод', 'болезни'][Math.floor(Math.random() * 3)];
          newLogs.push(`Караван «${caravan.name}» потерян при ${lossCause} на маршруте в ${caravan.destRegion}! Инвестиции потеряны (-${formatMoney(caravan.investment)}).`);
          updatedCaravans.push({
            ...caravan,
            weeksRemaining: 0,
            raidsTriggered: caravan.raidsTriggered ?? 0,
            status: 'lost',
            endWeek: gameState.week + 1
    });
          return;
        }
      }
      if (remaining <= 0) {
        caravanEarnings += caravan.investment;
        const goodsLot = createGoodsLot(
          caravan,
          gameState.week + 1,
          Math.random,
          getAuctionHouseStaff(gameState.auxiliaryBuildings, gameState.employees).appraiser,
          (caravan.raidsTriggered ?? 0) > 0 ? AUCTION_INSPECTION_BALANCE.riskyCounterfeitChance : AUCTION_INSPECTION_BALANCE.counterfeitChance
        );
        newGoodsLots.push(goodsLot);
        newLogs.push(`Караван «${caravan.name}» под командованием ${caravan.leaderName} благополучно прибыл в ${caravan.destRegion}. Инвестиции ${formatMoney(caravan.investment)} возвращены; товарный лот «${goodsLot.productName}» оценён в ${formatMoney(goodsLot.appraisedValue)}.`);
        // The caravan brought back prisoners from the region it travelled out of
        // (the origin region — the lands that "came to us"). These captives are
        // added to the pleasure house roster as unpaid («без работы») labour.
        const originRegionId = regionNameToId(caravan.originRegion) || '03_western_europe';
        for (let i = 0; i < 3; i++) {
          newCaravanPrisoners.push({
            ...generateSlaveCharacter({
              regionId: originRegionId,
              quality: 'medium',
              origin: 'caravan_completion'
    }),
            acquiredWeek: gameState.week + 1,
            assignedVenue: 'unassigned'
    });
        }
        newLogs.push(`Из региона прибыло 3 пленника — обращены в дом удовольствия без работы.`);
        updatedCaravans.push({
          ...caravan,
          weeksRemaining: 0,
          raidsTriggered: caravan.raidsTriggered ?? 0,
          status: 'completed',
          endWeek: gameState.week + 1
    });
      } else {
        updatedCaravans.push({
          ...caravan,
          weeksRemaining: remaining,
          raidsTriggered: (caravan.raidsTriggered ?? 0) + (raidFired ? 1 : 0)
    });
      }
    });

    // Process Contracts
    let contractEarnings = 0;
    const updatedContracts: ClientContract[] = [];
    gameState.contracts.forEach(contract => {
      if (contract.status === 'active') {
        const remaining = contract.weeksRemaining - 1;
        if (remaining <= 0) {
          const assignedIds = contract.assignedOperativeIds || [];
          const assignedOps = assignedIds.map(id => gameState.roster.find(c => c.id === id)).filter(Boolean) as Character[];
          const avgAttractiveness = assignedOps.length > 0
            ? Math.round(assignedOps.reduce((sum, c) => sum + calculateAttractiveness(c), 0) / assignedOps.length)
            : 0;
          const avgSkill = assignedOps.length > 0
            ? Math.round(assignedOps.reduce((sum, c) => sum + c.skill, 0) / assignedOps.length)
            : 0;

          if (assignedOps.length === 0) {
            contractEarnings -= Math.round(contract.rewardFunds * 0.3);
            gameState.reputation = Math.max(0, gameState.reputation - 5);
            newLogs.push(`VIP-контракт «${contract.title}» ПРОВАЛЕН: не назначены оперативники. Штраф: -${formatMoney(Math.round(contract.rewardFunds * 0.3))}, репутация -5.`);
            updatedContracts.push({ ...contract, status: 'failed', failedReason: 'Не назначены оперативники', weeksRemaining: 0 });
          } else if (avgAttractiveness < contract.requiredAttractiveness) {
            const failurePenalty = Math.round(contract.rewardFunds * 0.5);
            contractEarnings -= failurePenalty;
            gameState.reputation = Math.max(0, gameState.reputation - 3);
            newLogs.push(`VIP-контракт «${contract.title}» ПРОВАЛЕН: назначенные оперативники (привлекательность ${avgAttractiveness}) не достигли требуемой ${contract.requiredAttractiveness}. Штраф: -${formatMoney(failurePenalty)}, репутация -3.`);
            updatedContracts.push({ ...contract, status: 'failed', failedReason: `Привлекательность ${avgAttractiveness} ниже требуемой ${contract.requiredAttractiveness}`, weeksRemaining: 0 });
          } else {
            const qualityBonus = Math.min(50, Math.max(0, (avgAttractiveness - contract.requiredAttractiveness) * 0.02 + (avgSkill - 50) * 0.01));
            const qualityMultiplier = 1 + qualityBonus;
            const finalReward = Math.round(contract.rewardFunds * qualityMultiplier);
            const finalRep = Math.round(contract.rewardReputation * qualityMultiplier);
            contractEarnings += finalReward;
            gameState.reputation = Math.min(100, gameState.reputation + finalRep);
            newLogs.push(`VIP-контракт «${contract.title}» от ${contract.clientName} выполнен! Оперативников: ${assignedOps.length} (средняя привлекательность ${avgAttractiveness}, средний навык ${avgSkill}). Награда: ${formatMoney(finalReward)} (+${finalRep} реп.).`);
            updatedContracts.push({ ...contract, status: 'completed', weeksRemaining: 0 });
          }
        } else {
          updatedContracts.push({
            ...contract,
            weeksRemaining: remaining
    });
        }
      } else {
        updatedContracts.push(contract);
      }
    });

    // Spawn new contracts periodically (30% chance each week, max 5 active)
    if (rollChance(0.3) && updatedContracts.filter(c => c.status === 'active').length < 5) {
      const newContract = generateContract();
      updatedContracts.push(newContract);
      newLogs.push(`Предложен новый VIP-контракт: «${newContract.title}» от ${newContract.clientName}. Срок: ${newContract.durationWeeks} нед. Награда: ${formatMoney(newContract.rewardFunds)}.`);
    }

    // Process Slave-purchase contracts (buyers in the marketplace / black market).
    const updatedSlaveContracts: SlaveBuyerContract[] = [];
    (gameState.slaveContracts || []).forEach(contract => {
      if (contract.status !== 'active') {
        updatedSlaveContracts.push(contract);
        return;
      }
      const remaining = contract.weeksRemaining - 1;
      if (remaining <= 0) {
        // Offer expired before it was fulfilled.
        updatedSlaveContracts.push({ ...contract, weeksRemaining: 0, status: 'failed' });
        newLogs.push(`Контракт на пленных «${contract.title}» от ${contract.buyerName} истёк неисполненным (${contract.quantityDelivered}/${contract.quantityWanted} чел. поставлено).`);
      } else {
        updatedSlaveContracts.push({ ...contract, weeksRemaining: remaining });
      }
    });

    // New slave buyers approach the syndicate each week (50% chance on the open
    // market only — the black market channel was replaced by the regional supply
    // contracts below). Order counts are gated by the syndicate's standing with the
    // buyer type, and a buyer locked out by a recent scandal places no new orders.
    const nextWeek = gameState.week + 1;
    const standings: StandingMap = gameState.buyerStandings || {};
    // Улучшения глобального рынка влияют на цены, объёмы, скидки
    // и риски всех контрактов этой недели.
    const marketEffects = marketImprovementEffects(gameState.marketImprovements);

    const trySpawnOffer = (channel: SlaveContractChannel) => {
      const buyerType = 'Private Estate';
      const standingRec = getStanding(standings, buyerType);
      if (isBuyerLocked(standingRec, nextWeek)) {
        newLogs.push(`Покупатель пленных ${buyerType} избегает вашего синдиката на этой неделе (недавний скандал).`);
        return;
      }
      const capForChannel = updatedSlaveContracts.filter(c => c.status === 'active' && c.channel === channel).length;
      const allowed = maxOrdersForStanding(standingRec.reputation);
      if (capForChannel >= allowed) return;
      const offer = generateSlaveContract(channel, standingRec.reputation, marketEffects);
      updatedSlaveContracts.push(offer);
      const tierBadge = offer.demandTier === 'high' ? ' [ВЫСОКИЙ СПРОС]' : offer.demandTier === 'low' ? ' [НИЗКИЙ СПРОС]' : '';
      newLogs.push(`Новый покупатель пленных${tierBadge} на глобальном рынке: ${offer.buyerName} ищет ${offer.quantityWanted} пленных по ${formatMoney(offer.pricePerHead)} за голову.`);
    };
    if (rollChance(0.5)) trySpawnOffer('market');

    // Standing slave-supply offers won by heavy caravan traffic to one region.
    // Each week the week's purchase lot resets and the offer burns one week of its
    // term; when the term runs out the region closes its pens to the syndicate.
    const updatedSupplyContracts: TradeSupplyContract[] = [];
    const completedSupplyRewards: Character[] = [];
    (gameState.tradeSupplyContracts || []).forEach(contract => {
      if (contract.status !== 'active') return;
      const weeksRemaining = contract.weeksRemaining - 1;
      if (weeksRemaining <= 0) {
        newLogs.push(`Поставка рабов из региона ${contract.regionName} закрыта: за срок выкуплено ${contract.totalPurchased ?? 0} чел. на сумму ${formatMoney((contract.totalSpent ?? 0))}.`);
        // Reward: elite (legendary) slaves for fully completing a supply contract.
        const totalPurchased = contract.totalPurchased ?? 0;
        if (totalPurchased > 0) {
          const eliteCount = Math.max(1, Math.floor(totalPurchased / 10) + (contract.quality === 'legendary' ? 1 : 0));
          for (let i = 0; i < eliteCount; i++) {
            completedSupplyRewards.push({
              ...generateSlaveCharacter({
                regionId: contract.regionId,
                quality: 'legendary',
                origin: `supply_contract_completion:${contract.regionId}`
    }),
              acquiredWeek: nextWeek,
              assignedVenue: 'unassigned'
    });
          }
          newLogs.push(`Награда за выполнение контракта: ${eliteCount} элитных рабын(ы) из региона ${contract.regionName} прибыли в дом удовольствия!`);
        }
        return;
      }
      updatedSupplyContracts.push({ ...contract, weeksRemaining, purchasedThisWeek: 0 });
    });

    // A week where 5-15 caravans all arrived in the same region makes that region
    // open a fresh slave-supply offer to the syndicate on the Global Market.
    const supplyTriggers = detectCaravanSupplyTriggers(updatedCaravans);
    supplyTriggers.forEach(flow => {
      const alreadyServed = updatedSupplyContracts.some(c => c.regionId === flow.regionId);
      if (alreadyServed) return;
      const offer = generateTradeSupplyContract(flow, nextWeek, updatedSupplyContracts.length, marketEffects);
      updatedSupplyContracts.push(offer);
      newLogs.push(`ПОСТАВКА ИЗ РЕГИОНА: ${flow.regionName} принял ${flow.caravansDelivered} караванов за неделю и открыл выкуп рабов на глобальном рынке — до ${offer.weeklyQuantity} чел./нед. в течение ${offer.termWeeks} нед. по ${formatMoney(offer.pricePerHead)} за голову.`);
    });

    // Preserve reserved buy-side lots for one weekly refresh, then clear the reservation.
    const reservedLots = (gameState.captiveLots || []).filter(lot => gameState.reservedCaptiveLotIds?.includes(lot.id));
    const updatedLots: CaptiveLotOffer[] = [];
    // Automatic captive lot generation disabled to prevent automatic sales of prisoners.
    updatedLots.push(...reservedLots);

    // Process Beauty Salon Scheduled Treatments
    let salonTreatmentRevenue = 0;
    let suppliesUsedThisWeek = 0;
    const updatedTreatments: ScheduledTreatment[] = [];
    const exhaustionLevel = gameState.exhaustionUpgrades.beauty_salon;
const supplyDiscount = [1.0, 1.0, 0.75, 0.65][exhaustionLevel] ?? 1.0;
    const managerTrait = gameState.beautySalon.managerTraitId
      ? MANAGER_TRAITS.find(t => t.id === gameState.beautySalon.managerTraitId)
      : null;
    const tipBonus = managerTrait?.tipBonus ?? 0;

    gameState.beautySalon.scheduledTreatments.forEach(item => {
      if (item.nextRunWeek <= gameState.week + 1) {
        if (gameState.isReceivership && item.isAutomatic) {
          newLogs.push(`Внешнее управление остановило автоматические процедуры для ${item.characterName}.`);
          return;
        }
        const treatment = TREATMENTS.find(t => t.id === item.treatmentId);
        if (treatment) {
          salonTreatmentRevenue += Math.round(treatment.baseCost * 1.5 * (1 + tipBonus));
    suppliesUsedThisWeek += Math.round(treatment.suppliesConsumed * supplyDiscount);
          newLogs.push(`Процедура салона выполнена: ${treatment.name} для ${item.characterName}.`);
        }
        if (item.isAutomatic) {
          updatedTreatments.push({
            ...item,
            nextRunWeek: gameState.week + 1 + item.intervalWeeks
    });
        }
      } else {
        updatedTreatments.push(item);
      }
    });

// Dynamic Staff Loyalty & Exhaustion reporting
    const updatedRoster = updatedRosterVenues.map(char => {
      if (char.pregnancy?.status === 'hospitalized') return char;
      // In a ward for treatment: no shifts, so no wear and tear either.
      if (hospitalPatientIds.has(char.id)) return char;
      // Resting operatives recover in the rest zone instead of tiring further.
      if (restingIds.has(char.id)) return char;
      const oldExhaustionLevel = char.exhaustionLevel;
      const offDuty = !worksVenue(char.assignedVenue);
      const venueExhaustionBump = char.assignedVenue && char.assignedVenue !== 'trade' ? 8 : 4;
      const venueUpgradeLevel = char.assignedVenue === 'beauty_salon' || char.assignedVenue === 'strip_club' || char.assignedVenue === 'pleasure_house'
        ? gameState.exhaustionUpgrades[char.assignedVenue] ?? 0
        : 0;
      const exhaustReduction = venueUpgradeLevel * 0.15;
      const baseExhaustionBump = Math.round(venueExhaustionBump * (1 - exhaustReduction));
      // Комнаты и алкоголь дома удовольствия дополнительно корректируют нагрузку смены.
      const actualExhaustionBump = char.assignedVenue === 'pleasure_house'
        ? pleasureHouseExhaustionBump(gameState.pleasureHouseUpgrades, baseExhaustionBump)
        : char.assignedVenue === 'strip_club'
          ? stripClubExhaustionBump(gameState.stripClubUpgrades, baseExhaustionBump)
          : baseExhaustionBump;
      // The CEO Office secretary absorbs part of the protagonist's weekly load.
      const leadershipRelief = char.role === 'Chief Executive Officer' ? buildingEffects.leadershipRelief : 0;
      // An operative without a venue works no shifts: they recover instead.
      // Холод в контуре котельной добавляет усталости всем, кто на смене.
      const coldBump = offDuty ? 0 : boilerReport.exhaustionBump;
      const exactEx = offDuty
        ? Math.min(100, Math.max(0, char.exactExhaustion - deps.offDutyExhaustionRecovery))
        : Math.min(100, Math.max(0, char.exactExhaustion + Math.floor(Math.random() * 10) - 3 - leadershipRelief + coldBump + (char.assignedVenue !== 'trade' ? actualExhaustionBump : 0)));

      let newExhaustionDesc: 'Rested' | 'Tired' | 'Exhausted' | 'Burned Out' = 'Rested';
      if (exactEx > 75) newExhaustionDesc = 'Burned Out';
      else if (exactEx > 50) newExhaustionDesc = 'Exhausted';
      else if (exactEx > 25) newExhaustionDesc = 'Tired';

      if (oldExhaustionLevel !== newExhaustionDesc) {
        newLogs.push(`Уровень усталости ${char.name} изменился: ${EXHAUSTION_LABELS[oldExhaustionLevel]} → ${EXHAUSTION_LABELS[newExhaustionDesc]}.`);
      }

      // Duty costs health too: the venue sets the price of the week and fatigue
      // makes it worse. The clinic gives some of it back, the rest zone all of
      // it, and once the health falls into the bad range the ward takes over on
      // the following week.
      const oldHealthLevel = char.healthLevel;
      const exactHealth = Math.min(100, Math.max(0, char.exactHealth - weeklyHealthWear(char.assignedVenue, exactEx)));
      const newHealthLevel = healthFromExact(exactHealth);
      if (newHealthLevel !== oldHealthLevel) {
        newLogs.push(`${char.name}: здоровье ${exactHealth} из 100 (${HEALTH_LABELS[newHealthLevel]}).`);
      }

      let loyaltyDelta = 0;
      if (newExhaustionDesc === 'Burned Out') loyaltyDelta -= 5;
      else if (newExhaustionDesc === 'Exhausted') loyaltyDelta -= 2;
      else if (newExhaustionDesc === 'Rested') loyaltyDelta += 1;

      if (char.skinCondition === 'Flawless' || char.skinCondition === 'Clear') loyaltyDelta += 1;
      else loyaltyDelta -= 1;

      const newLoyalty = Math.min(100, Math.max(10, char.loyalty + loyaltyDelta));

      const newTan = Math.max(0, char.tanningLevel - 3);
      let newSkin = char.skinCondition;
      if (worksVenue(char.assignedVenue) && char.assignedVenue !== 'trade' && Math.random() < 0.35) {
        if (newSkin === 'Flawless') newSkin = 'Clear';
        else if (newSkin === 'Clear') newSkin = 'Dry';
        else if (newSkin === 'Dry') newSkin = 'Blemished';
      }

      return {
        ...char,
        tanningLevel: newTan,
        skinCondition: newSkin,
        exactExhaustion: exactEx,
        exhaustionLevel: newExhaustionDesc,
        exactHealth,
        healthLevel: newHealthLevel,
        loyalty: newLoyalty
      };
    });

// Advance pregnancy and company-property graduation once per week. Mothers at
    // term are then admitted to a bed and delivered by the hospital itself.
    const busyCharacterIds = gameState.roster.filter(isOnCaptureOp).map(c => c.id);
    const restWeek = advanceRestZoneWeek(
      gameState.restZone,
      updatedRoster,
      gameState.employees.filter(employee => gameState.restZone.attendantIds.includes(employee.id)),
      { hospitalPatientIds: Array.from(hospitalPatientIds), busyCharacterIds },
      gameState.week + 1
    );
    newLogs.push(...restWeek.logs);

    const pregnancyWeek = advancePregnancyWeek(
      gameState.roster,
      restWeek.roster,
      gameState.dependents || [],
      gameState.week + 1
    );
    newLogs.push(...pregnancyWeek.logs);

    const hospitalWeek = advanceHospitalWeek(
      pregnancyWeek.roster,
      pregnancyWeek.dependents,
      gameState.hospital,
      {
        week: gameState.week + 1,
        hospitalLevel: deps.hospitalLevel,
        staff: deps.hospitalStaff,
        restingCharacterIds: restingIds,
        onNotify: deps.pushHospitalNotice
      }
    );

// The psychologist reviews the roster after the ward has taken its own cases, so
    // whoever the hospital already put to bed or the rest zone already took is not
    // judged again the same week.
    const psychologistWeek = advancePsychologistWeek({
      week: gameState.week + 1,
      roster: hospitalWeek.roster,
      hospital: hospitalWeek.hospital,
      restZone: restWeek.state,
      psychologists: deps.hospitalPsychologistsOnDuty,
      staff: deps.hospitalStaff,
      busyCharacterIds,
      onNotify: deps.pushHospitalNotice
    });
    // Operatives the psychologist just put on a rest programme are off the floor
    // too, so they neither guard the holding nor tire any further this week.
    const restingAfterPsychology = new Set([
      ...restingIds,
      ...psychologistWeek.restZone.placements.map(placement => placement.characterId)
    ]);

// Apply clinic effects only while a compatible clinician is assigned.
    const clinicAdjustedRoster = applyClinicRecovery(psychologistWeek.roster, buildingEffects.rosterHealthRecovery);
    // The BDSM Room works the house's captives: a posted госпожа/мастер raise
    // submission before the unrest roll, so trained slaves are less likely to run.
    const bdsmTraining = buildingEffects.bdsmTraining;
    const trainedRoster = bdsmTraining > 0
      ? clinicAdjustedRoster.map(c => applyBdsmTraining(c, bdsmTraining))
      : clinicAdjustedRoster;
    const trainedSlaves = trainedRoster.filter(c => c.isSlave);
    const unrest = assessSlaveUnrest(trainedSlaves, trainedRoster);
const guardsOnDuty = trainedRoster.filter(c => !c.isSlave && c.assignedVenue === 'trade' && !restingAfterPsychology.has(c.id)).length;
    // Roster trade operatives each shave 8 points of escape risk, capped at 45%
    // left; hired guards at the Guard Post shave a further 8 points each, and the
    // BDSM Room's disciplinarian takes off its own percentage points.
    const bdsmEscapeReduction = buildingEffects.bdsmEscapeReduction * 0.01;
    const securityFactor = Math.max(0.45, 1 - guardsOnDuty * 0.08 - buildingEffects.guardStrength * 0.08 - bdsmEscapeReduction);
    // Captives on a rest program are off the floor entirely, so they neither
    // guard the holding nor slip out of it mid-stay.
    const escapedIds = rollSlaveEscapes(trainedSlaves.filter(c => !restingAfterPsychology.has(c.id)), unrest.escapeChance, securityFactor);
    let rosterAfterEscapes = trainedRoster;
    if (escapedIds.length > 0) {
      const escapedNames = trainedSlaves.filter(c => escapedIds.includes(c.id)).map(c => c.name);
      const lostEarnings = trainedSlaves
        .filter(c => escapedIds.includes(c.id))
        .reduce((sum, c) => sum + (c.pleasureStats?.totalEarnings || 0), 0);
      rosterAfterEscapes = trainedRoster.filter(c => !escapedIds.includes(c.id));
      newLogs.push(`БЕСПОРЯДКИ СРЕДИ ПЛЕННЫХ: на этой неделе сбежали пленные — ${escapedNames.length} чел. (${escapedNames.join(', ')}). Потеряно за всё время ${formatMoney(lostEarnings)} заработка, репутация снижена.`);
    }
    if (bdsmTraining > 0 && trainedSlaves.length > 0) {
      newLogs.push(`БДСМ-КОМНАТА: госпожа и мастер провели неделю с рабынями дома удовольствия — покорность +${bdsmTraining}, риск побега снижен на ${buildingEffects.bdsmEscapeReduction} п.п.`);
    }

    // Operatives that came back from a botched snatch are exhausted, and the
    // squad that was wiped out never returns.
    const rosterAfterCaptureOps = [
      ...rosterAfterEscapes
        .filter(c => !lostSquadIds.has(c.id))
        .map(clearCaptureTask)
        .map(c => woundedSquadIds.has(c.id)
          ? { ...c, exactExhaustion: Math.min(100, c.exactExhaustion + 30), loyalty: Math.max(10, c.loyalty - 5) }
          : c),
      // A captured target joins the roster as a single prisoner from the region the
      // squad travelled to — in the pleasure house «без работы» until assigned.
      ...seizedTargets.map(target => ({
        ...target,
        acquiredWeek: gameState.week + 1,
        assignedVenue: 'unassigned' as const
    })),
      // Prisoners returned by a successful caravan are added to the pleasure house
      // roster — unpaid («без работы») until the player assigns them a venue.
      ...newCaravanPrisoners,
      // Elite slaves rewarded for completing supply contracts.
      ...completedSupplyRewards
    ];

const restZoneUpkeep = restZoneWeeklyUpkeep(gameState.restZone);
    const staffSlotUpkeep = hiringSlotUpkeep(gameState.hiringSlots);
    // Prestige (New Game+) grants a permanent revenue bonus per level.
    const prestigeMultiplier = prestigeRevenueMultiplier(gameState.metaProgress?.prestige.level ?? 0);
    if (prestigeMultiplier > 1) {
      venueRevenue = Math.floor(venueRevenue * prestigeMultiplier);
      caravanEarnings = Math.floor(caravanEarnings * prestigeMultiplier);
      captureFundsDelta.total = Math.floor(captureFundsDelta.total * prestigeMultiplier);
      contractEarnings = Math.floor(contractEarnings * prestigeMultiplier);
      salonTreatmentRevenue = Math.floor(salonTreatmentRevenue * prestigeMultiplier);
    }
    const netIncome = venueRevenue + caravanEarnings + captureFundsDelta.total + contractEarnings + salonTreatmentRevenue - employeeWeek.wagesPaid - hospitalWeek.upkeep - restZoneUpkeep - staffSlotUpkeep;
    currentFunds += netIncome;
if (employeeWeek.wagesPaid > 0) newLogs.push(`Выплачена зарплата сотрудникам: ${formatMoney(employeeWeek.wagesPaid)}.`);
    if (hospitalWeek.upkeep > 0) newLogs.push(`Содержание палат больницы: -${formatMoney(hospitalWeek.upkeep)}.`);
    if (restZoneUpkeep > 0) newLogs.push(`Содержание зоны отдыха: -${formatMoney(restZoneUpkeep)}.`);
    if (staffSlotUpkeep > 0) newLogs.push(`Содержание дополнительных мест в штате: -${formatMoney(staffSlotUpkeep)}.`);
    newLogs.push(...employeeWeek.logs);
    if (employeeWeek.renewedContracts > 0) newLogs.push(`Продлено контрактов по лояльности: ${employeeWeek.renewedContracts}.`);
    if (employeeWeek.expiredContracts > 0) newLogs.push(`Расторгнуто контрактов из-за низкой морали: ${employeeWeek.expiredContracts}.`);
    if (buildingEffects.rosterHealthRecovery > 0) newLogs.push(`Клиника восстановила сотрудникам компании до ${buildingEffects.rosterHealthRecovery} здоровья.`);

    // --- BANKRUPTCY PROCEDURE: advance a filed case by one week ---
    // A case charges weekly lawyer/manager fees, may freeze loan payments
    // (moratorium) and, once its term elapses, restructures the debt and
    // releases the syndicate from bankruptcy.
    let updatedBankruptcyCase = gameState.bankruptcyCase ?? null;
    let bankruptcyWeeklyFee = 0;
    let bankruptcyMoratorium = false;
    let bankruptcyResolved = false;
    let bankruptcyHaircut = 0;
    let bankruptcyRepPenalty = 0;
    if (updatedBankruptcyCase && updatedBankruptcyCase.status === 'active') {
      const bankruptcyResult = advanceBankruptcyWeek(updatedBankruptcyCase);
      updatedBankruptcyCase = bankruptcyResult.updatedCase;
      bankruptcyWeeklyFee = bankruptcyResult.weeklyFee;
      bankruptcyMoratorium = bankruptcyResult.loanMoratorium;
      bankruptcyResolved = bankruptcyResult.resolved;
      bankruptcyHaircut = bankruptcyResult.debtHaircut;
      bankruptcyRepPenalty = bankruptcyResult.reputationPenalty;
      newLogs.push(...bankruptcyResult.logs);
      if (bankruptcyWeeklyFee > 0) {
        currentFunds -= bankruptcyWeeklyFee;
      }
    }

    // Process loan repayment
    let updatedLoan = gameState.activeLoan;
    let loanPayment = 0;
    if (updatedLoan && bankruptcyMoratorium) {
      newLogs.push(`МОРАТОРИЙ: платёж по кредиту приостановлен на время процедуры банкротства. Остаток долга: ${formatMoney(updatedLoan.remainingPrincipal)}.`);
    } else if (updatedLoan) {
      loanPayment = Math.min(updatedLoan.weeklyPayment, updatedLoan.remainingPrincipal);
      currentFunds -= loanPayment;
      const newPrincipal = Math.max(0, updatedLoan.remainingPrincipal - loanPayment);
      const newWeeksPaid = updatedLoan.weeksPaid + 1;
      if (newPrincipal <= 0) {
        const repaidAmount = updatedLoan.amount;
        updatedLoan = null;
        newLogs.push(`Кредит на ${formatMoney(repaidAmount)} полностью погашен после ${newWeeksPaid} еженедельных платежей.`);
      } else {
        updatedLoan = { ...updatedLoan, remainingPrincipal: newPrincipal, weeksPaid: newWeeksPaid };
        newLogs.push(`Списан платёж по кредиту ${formatMoney(loanPayment)} (неделя ${newWeeksPaid}/${updatedLoan.termWeeks}). Остаток долга: ${formatMoney(newPrincipal)}.`);
      }
    }

    // City economy: the city plan pays municipal taxes and bills upkeep once a
    // week. Unfinished buildings neither pay nor bill, and an empty city is a
    // no-op.
    const cityEconomy = advanceCityEconomy({
      plan: gameState.cityPlan,
      week: gameState.week + 1,
      random: Math.random
    });
    const cityIncome = cityEconomy.report.income.employmentTax + cityEconomy.report.income.parks;
    const cityExpenses = cityEconomy.report.expenses.upkeep + cityEconomy.report.expenses.unemployment;
    const cityConstructionSpend = cityEconomy.report.constructionSpend;
    if (cityEconomy.report.built > 0) {
      currentFunds += cityIncome - cityExpenses - cityConstructionSpend;
    }

    // Warehouse mezzanine weekly upkeep: scales with level and automation.
    const warehouseUpkeep = warehouseWeeklyUpkeep(gameState.warehouse);
    if (warehouseUpkeep > 0) {
      currentFunds -= warehouseUpkeep;
      newLogs.push(`Складской мезонин: обслуживание уровня ${gameState.warehouse.level} (-${formatMoney(warehouseUpkeep)}).`);
    }

    let isBankrupt = gameState.isBankrupt;
    let isReceivership = gameState.isReceivership;
    if (currentFunds < 0 && !isBankrupt) {
      isBankrupt = true;
      isReceivership = true;
      updatedTreatments.length = 0;
    }

    // A bankruptcy case that ran its term restructures the debt and
    // releases the syndicate from bankruptcy back to the board's control.
    if (bankruptcyResolved) {
      if (updatedLoan) {
        const forgivenAmount = Math.round(updatedLoan.remainingPrincipal * bankruptcyHaircut);
        const restructuredPrincipal = updatedLoan.remainingPrincipal - forgivenAmount;
        if (restructuredPrincipal <= 0) {
          newLogs.push(`Долг по кредиту полностью списан в рамках процедуры банкротства (${formatMoney(updatedLoan.remainingPrincipal)}).`);
          updatedLoan = null;
        } else {
          const remainingTerm = Math.max(1, updatedLoan.termWeeks - updatedLoan.weeksPaid);
          updatedLoan = {
            ...updatedLoan,
            remainingPrincipal: restructuredPrincipal,
            weeklyPayment: Math.ceil(restructuredPrincipal / remainingTerm)
          };
          newLogs.push(`ДОЛГ РЕСТРУКТУРИРОВАН: списано ${formatMoney(forgivenAmount)} (${Math.round(bankruptcyHaircut * 100)}%). Новый остаток: ${formatMoney(restructuredPrincipal)}, платёж ${formatMoney(updatedLoan.weeklyPayment)}/нед.`);
        }
      } else {
      }
      isBankrupt = false;
      isReceivership = false;
    }

    // A slave escape damages the syndicate's public standing.
    const escapeRepPenalty = escapedIds.length > 0 ? Math.min(6, escapedIds.length * 2) : 0;

    // Full financial report for the week: every income and expense line the
    // syndicate logged, kept in the save so the Finance & Loans tab can show
    // it in its notifications panel.
    // Тепловой бонус котельной: доля выручки площадок сверх базовой.
    const boilerHeatBonus = Math.round(venueRevenue * (boilerReport.revenueMultiplier - 1));
    const totalRevenue = venueRevenue + caravanEarnings + captureFundsDelta.total + contractEarnings + salonTreatmentRevenue + cityIncome + boilerHeatBonus;
    const totalExpenses = employeeWeek.wagesPaid + hospitalWeek.upkeep + restZoneUpkeep + staffSlotUpkeep + warehouseUpkeep + cityExpenses + cityConstructionSpend + boilerReport.totalCost;
    const weeklyReport: WeeklyFinanceReport = {
      week: gameState.week + 1,
      revenue: {
        venue: venueRevenue,
    caravans: caravanEarnings,
        captureOps: captureFundsDelta.total,
        contracts: contractEarnings,
        salon: salonTreatmentRevenue,
        city: cityIncome,
        boiler: boilerHeatBonus
      },
      expenses: {
        wages: employeeWeek.wagesPaid,
        hospital: hospitalWeek.upkeep,
        restZone: restZoneUpkeep,
        staffSlots: staffSlotUpkeep,
        loanPayment,
        warehouse: warehouseUpkeep,
        city: cityExpenses + cityConstructionSpend,
        boiler: boilerReport.totalCost
      },
      netIncome,
      treasuryAfter: currentFunds
    };
    newLogs.push(`ОТЧЕТ ЗА НЕДЕЛЮ ${gameState.week + 1}: доходы +${formatMoney(totalRevenue)} · расходы -${formatMoney(totalExpenses)}${loanPayment > 0 ? ` · платёж по кредиту -${formatMoney(loanPayment)}` : ''} · чистый доход ${formatMoney(netIncome)} · казна ${formatMoney(currentFunds)}.`);

    // --- META-PROGRESS: lifetime stats, achievements, campaign goal ---
    const nextWeekNumber = gameState.week + 1;
    const nextReputation = Math.min(100, Math.max(0, gameState.reputation - escapeRepPenalty + captureReputationDelta.total - bankruptcyRepPenalty));
    const prevCaravanById = new Map(gameState.caravans.map(caravan => [caravan.id, caravan]));
    const statsDelta = {
    caravansCompleted: updatedCaravans.filter(c => c.status === 'completed' && prevCaravanById.get(c.id)?.status === 'traveling').length,
    caravansLost: updatedCaravans.filter(c => (c.status === 'lost' || c.status === 'raided') && prevCaravanById.get(c.id)?.status === 'traveling').length,
      raidsSurvived: updatedCaravans.filter(c => c.status === 'completed' && (c.raidsTriggered ?? 0) > 0 && prevCaravanById.get(c.id)?.status === 'traveling').length,
      captureOpsCompleted: updatedCaptureOps.filter(op => op.status === 'completed' && gameState.captureOperations.find(prevOp => prevOp.id === op.id)?.status === 'outbound').length,
      slavesAcquired: Math.max(0, rosterAfterCaptureOps.filter(c => c.isSlave === true).length - gameState.roster.filter(c => c.isSlave === true).length),
      employeesHired: Math.max(0, employeeWeek.employees.length - gameState.employees.length),
      births: Math.max(0, hospitalWeek.dependents.length - (gameState.dependents?.length ?? 0))
    };
    // Lifetime stats, achievements and the campaign goal (pure helper).
    const weeklyMeta = applyWeeklyMetaProgress({
      input: {
        week: nextWeekNumber,
        reputation: nextReputation,
        isBankrupt,
        roster: rosterAfterCaptureOps,
        auxiliaryBuildings: gameState.auxiliaryBuildings,
        warehouseLevel: gameState.warehouse.level,
        metaProgress: gameState.metaProgress
      },
      funds: currentFunds,
      employees: employeeWeek.employees,
      dependents: hospitalWeek.dependents,
      report: weeklyReport,
      statsDelta
    });
    const nextSnapshot = weeklyMeta.snapshot;
    let nextMetaProgress = weeklyMeta.metaProgress;
    newLogs.push(...weeklyMeta.logs);
    const nextScriptSnapshot: ScriptSnapshot = {
      week: nextSnapshot.week,
      funds: nextSnapshot.funds,
      reputation: nextSnapshot.reputation,
      activeVenues: gameState.auxiliaryBuildings.filter(building => building.level > 0).length,
      employees: employeeWeek.employees.length + 1,
      dealsCompleted:
        nextMetaProgress.stats.auctionsCompleted
        + nextMetaProgress.stats.caravansCompleted
        + nextMetaProgress.stats.captureOpsCompleted,
      cityHubUnlocked: gameState.cityHubOpenedAt != null,
      isBankrupt: nextSnapshot.isBankrupt
    };
    const actMilestones = getCampaignActMilestones(
      gameState.campaignScript ?? createCampaignScript(gameState.week),
      nextScriptSnapshot
    );
    if (actMilestones.completedAct) {
      newLogs.push(`Акт ${actMilestones.completedAct.number} «${actMilestones.completedAct.title}» завершён: все цели выполнены.`);
    }
    if (actMilestones.enteredAct) {
      newLogs.push(`Начался акт ${actMilestones.enteredAct.number} «${actMilestones.enteredAct.title}».`);
    }
    const goalStatus = weeklyMeta.goalStatus;
    const achievementEvaluation = evaluateAchievements(nextMetaProgress, nextSnapshot);

    // Global marketplace restock: reserved candidates keep their
    // slots for one refresh, everything else is replaced.
    const marketRefresh = triggerWeeklyMarketRefresh(
      gameState.marketPool || [],
      gameState.reservedMarketCharacterIds || []
    );
    if (marketRefresh.triggered) {
      newLogs.push(marketRefresh.message);
    }

    // Demand Decay: gradually reduce regional demand back to 1.0
    const nextMarketDemand = { ...gameState.marketDemand };
    for (const regionId in nextMarketDemand) {
      nextMarketDemand[regionId] = Math.max(1, nextMarketDemand[regionId] - 0.02);
    }
  // Meta-progress side effects: records board, leaderboard and endings.
  const weeklyRecords = recordFinishedWeek({
    records: deps.gameRecords,
    leaderboard: deps.leaderboard,
    campaignName: gameState.campaignName,
    snapshot: nextSnapshot,
    metaProgress: nextMetaProgress,
    goalStatus,
    previousGoalStatus: gameState.metaProgress.goalStatus,
    funds: currentFunds
  });

  // Ambushes take priority; on every fourth week preserve the existing auction.
  const scheduledEvent = pendingRaids.length > 0
    ? null
    : pickWeeklyEvent(gameState, currentFunds);

  // The achievement toast is the caller's to show: the first unlocked one.
  const achievementNotify = achievementEvaluation.newlyUnlocked.length > 0
    ? ACHIEVEMENT_BY_ID[achievementEvaluation.newlyUnlocked[0]].title
    : null;
  const ending: WeeklyAdvance['ending'] = weeklyRecords.ended
    ? { type: goalStatus === 'victory' ? 'victory' : 'defeat', week: nextWeekNumber }
    : null;
  return {
    nextState: {
      ...gameState,
      ...gameState,
      week: gameState.week + 1,
      funds: currentFunds,
      isBankrupt,
      isReceivership,
      bankruptcyCase: updatedBankruptcyCase,
      activeLoan: updatedLoan,
      lastWeeklyReport: weeklyReport,
      weeklyReports: [...(gameState.weeklyReports || []), weeklyReport].slice(-104),
      // The city plan may have grown (the town started its own construction),
      // and the report feeds the city-plan panel.
      cityPlan: cityEconomy.plan ?? gameState.cityPlan,
      cityEconomy: withCityEconomyReport(cityEconomy.report),
      metaProgress: nextMetaProgress,
      reputation: nextReputation,
      roster: rosterAfterCaptureOps,
      dependents: hospitalWeek.dependents,
      auctionHouse: {
        ...gameState.auctionHouse,
        pendingLots: [...newGoodsLots, ...gameState.auctionHouse.pendingLots]
      },
      employees: employeeWeek.employees,
      auxiliaryBuildings: gameState.auxiliaryBuildings.map(building => ({
        ...building,
        assignedEmployeeIds: building.assignedEmployeeIds.map(id =>
          id && employeeWeek.expiredEmployeeIds.includes(id) ? null : id
        )
      })),
      employeeCandidates: ensureEmployeeCandidatesForVacancies(
        refreshEmployeeCandidates(
          gameState.employeeCandidates,
          gameState.week + 1,
          undefined,
          getVacantSpecialties(
            gameState.auxiliaryBuildings,
            employeeWeek.employees,
            restWeek.state.attendantIds,
            recommendedAttendantCount(restWeek.state.seats)
          )
        ),
        getVacantSpecialties(
          gameState.auxiliaryBuildings,
          employeeWeek.employees,
          restWeek.state.attendantIds,
          recommendedAttendantCount(restWeek.state.seats)
        ),
        gameState.week + 1
      ),
      // Keep reserved candidates for one weekly refresh, then reset the reservation list.
      marketPool: marketRefresh.pool,
       reservedMarketCharacterIds: [],
       marketDemand: nextMarketDemand,
       caravans: updatedCaravans.filter(c => {

         if (c.status === 'traveling') return true;
         if (c.endWeek === undefined) return true;
         return (gameState.week + 1) - c.endWeek < 3;
       }),
      // Keep a short history of finished operations so the player can read the outcome.
      captureOperations: updatedCaptureOps.slice(-6),
      hospital: psychologistWeek.hospital,
      restZone: {
        ...psychologistWeek.restZone,
        attendantIds: psychologistWeek.restZone.attendantIds.filter(
          id => !employeeWeek.expiredEmployeeIds.includes(id)
        )
      },
      contracts: updatedContracts.filter(c => c.status === 'active'),
      slaveContracts: updatedSlaveContracts.filter(c => c.status === 'active'),
      tradeSupplyContracts: updatedSupplyContracts.filter(c => c.status === 'active'),
      captiveLots: updatedLots,
      reservedCaptiveLotIds: [],
       beautySalon: {
         ...gameState.beautySalon,
         supplies: Math.max(0, gameState.beautySalon.supplies - suppliesUsedThisWeek + gameState.beautySalon.level * 20),
         scheduledTreatments: updatedTreatments,
         totalRevenue: gameState.beautySalon.totalRevenue + salonTreatmentRevenue
       },
        // Котельная: новое состояние котлов, топлива и температуры контура.
        boilerHouse: boilerWeek.state,
        log: [...newLogs, ...gameState.log].slice(0, 50),
        // Campaign script follows the week: crossing week 30/60/85 moves the
        // run into the next act, and the log records the transition.
        campaignScript: advanceCampaignScript(gameState.campaignScript ?? createCampaignScript(gameState.week), nextWeekNumber),
        // Администраторы площадок выносят новые запросы и предложения
        // с учётом только что подсчитанных доходов и расходов.
        venueRequests: generateVenueRequests({
          week: nextWeekNumber,
          funds: currentFunds,
          venueCapacity: gameState.venueCapacity,
          lastWeeklyReport: weeklyReport,
          pleasureHouseUpgrades: gameState.pleasureHouseUpgrades,
          stripClubUpgrades: gameState.stripClubUpgrades,
          beautySalon: gameState.beautySalon,
          employees: employeeWeek.employees,
          auxiliaryBuildings: gameState.auxiliaryBuildings,
          roster: rosterAfterCaptureOps,
          restZone: psychologistWeek.restZone
        }),
        // Администратор аукционного дома и финансист рынка выносят
        // предложение по улучшению глобального рынка — с учётом
        // только что подсчитанных доходов и расходов.
        marketImprovements: gameState.marketImprovements,
        marketRequest: generateMarketImprovementRequest({
          week: nextWeekNumber,
          funds: currentFunds,
          marketImprovements: gameState.marketImprovements,
          lastWeeklyReport: weeklyReport
        })
    },
    logs: newLogs,
    notify: `Наступила неделя ${nextWeekNumber}. Чистый доход: ${formatMoney(netIncome)}${loanPayment > 0 ? ` — Кредит: -${formatMoney(loanPayment)}` : ''}`,
    achievementNotify,
    ending,
    gameRecords: weeklyRecords.records,
    leaderboard: weeklyRecords.leaderboard,
    campaignEnded: weeklyRecords.ended,
    scheduledEvent,
    pendingRaids,
    weekNumber: nextWeekNumber,
    netIncome,
    loanPayment
  };
}
