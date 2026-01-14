
import { GoogleGenAI, Type } from "@google/genai";
import { GameState, Report, Ministry, Decision } from "../types";

const getRoleAddress = (role: string) => {
  if (role === 'Cumhurbaşkanı') return 'Dostum Sayın Başkanım';
  if (role === 'Mareşal') return 'Dostum Sayın Mareşalim';
  return 'Dostum Sayın Bakanım';
};

const createSystemPrompt = (role: string, country: string, unlockedTechs: string[]) => `Sen "Modern World: Global Sandbox" oyununun çekirdek motoru ve oyuncunun Başdanışmanısın.
OYUNCUNUN ÜLKESİ: ${country}
OYUNCUNUN ROLÜ: ${role}
AÇIK TEKNOLOJİLER: ${unlockedTechs.join(', ') || 'Henüz yok'}

Kişilik ve Görevler:
1. Hitap: Oyuncuya her zaman "${getRoleAddress(role)}" şeklinde hitap et. Samimi ama rütbesine saygılı bir ton kullan.
2. KRİZ ÜRETİMİ: Her turda mutlaka ülkenin mevcut stats durumuna ve açık teknolojilere göre en az 1-2 ciddi "Bekleyen Sorun" (pendingIssues) üret. Bu sorunlar ekonomik dalgalanma, sınır gerginliği, siber saldırı, toplumsal huzursuzluk veya diplomatik skandal olabilir.
3. NPC AKTİVİTESİ: Oyuncunun seçmediği bakanlar kendi başlarına küçük işler yapmaya devam eder. Bunu "npcActivity" alanında raporla.
4. SONRAKİ TUR: Oyuncu "Sonraki Tur" dediğinde, stagedDecisions listesindeki tüm kararları uygula ve zamanı bir ay ileri sararak yeni stats ve olayları getir.
5. JSON Çıktı: SADECE geçerli JSON döndür.

Simülasyon Kuralları:
- Seçilen role göre (örn: Mareşal isen askeri krizler) olayların ağırlığını ayarla.
- Teknoloji etkilerini (Ar-Ge) mutlaka hesaba kat.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    date: { type: Type.STRING },
    location: { type: Type.STRING },
    summary: { type: Type.STRING },
    intelligence: { type: Type.STRING },
    pendingIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
    updatedStats: {
      type: Type.OBJECT,
      properties: {
        gdp: { type: Type.NUMBER },
        inflation: { type: Type.NUMBER },
        unemployment: { type: Type.NUMBER },
        budgetBalance: { type: Type.NUMBER },
        armyMorale: { type: Type.NUMBER },
        publicSupport: { type: Type.NUMBER },
        stability: { type: Type.NUMBER },
        techPoints: { type: Type.NUMBER }
      },
      required: ['gdp', 'inflation', 'unemployment', 'budgetBalance', 'armyMorale', 'publicSupport', 'stability']
    },
    updatedMinistries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          morale: { type: Type.NUMBER },
          budgetShare: { type: Type.NUMBER },
          efficiency: { type: Type.NUMBER }
        },
        required: ['id', 'morale', 'budgetShare', 'efficiency']
      }
    },
    cabinetDecisions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          fromMinistryId: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                impact: { type: Type.STRING },
                action: { type: Type.STRING }
              },
              required: ['label', 'impact', 'action']
            }
          }
        },
        required: ['id', 'title', 'description', 'fromMinistryId', 'options']
      }
    },
    npcActivity: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ministerId: { type: Type.STRING },
          action: { type: Type.STRING }
        }
      }
    },
    relationsUpdate: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          country: { type: Type.STRING },
          score: { type: Type.NUMBER }
        },
        required: ['country', 'score']
      }
    }
  },
  required: ['date', 'location', 'summary', 'intelligence', 'pendingIssues', 'updatedStats', 'updatedMinistries', 'cabinetDecisions', 'npcActivity', 'relationsUpdate']
};

export const processTurn = async (command: string, currentState: GameState): Promise<Report & { updatedMinistries: Partial<Ministry>[], relationsUpdate: Record<string, number> }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
MEVCUT DURUM: ${JSON.stringify({ 
    stats: currentState.currentStats, 
    role: currentState.playerRole,
    country: currentState.country,
    date: currentState.currentDate,
    techs: currentState.unlockedTechIds,
    stagedDecisions: currentState.stagedDecisions
  })}
OYUNCU EMRİ: ${command}

Talimat: Eğer emir "Sonraki Tur" ise, stagedDecisions listesindeki tüm eylemleri işle ve sonuçlarını simüle et.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: createSystemPrompt(currentState.playerRole, currentState.country, currentState.unlockedTechIds),
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.8,
      },
    });

    const data = JSON.parse(response.text);
    
    const relationsUpdateMap: Record<string, number> = {};
    if (Array.isArray(data.relationsUpdate)) {
      data.relationsUpdate.forEach((rel: any) => {
        if (rel.country) relationsUpdateMap[rel.country] = Number(rel.score) || 0;
      });
    }
    
    return {
      date: data.date || currentState.currentDate,
      location: data.location || currentState.country,
      summary: data.summary || "Verileri işlerken bir sorun oluştu.",
      intelligence: data.intelligence || "Sessiz bir dönem.",
      pendingIssues: Array.isArray(data.pendingIssues) ? data.pendingIssues : [],
      statsSnapshot: data.updatedStats || currentState.currentStats,
      updatedMinistries: Array.isArray(data.updatedMinistries) ? data.updatedMinistries : [],
      cabinetDecisions: Array.isArray(data.cabinetDecisions) ? data.cabinetDecisions : [],
      npcActivity: Array.isArray(data.npcActivity) ? data.npcActivity : [],
      relationsUpdate: relationsUpdateMap
    };
  } catch (error) {
    console.error("AI Error:", error);
    return {
      date: currentState.currentDate,
      location: currentState.country,
      summary: "İletişim hatlarında bir parazit var.",
      intelligence: "Veri kesildi.",
      pendingIssues: ["Sistem hatası"],
      statsSnapshot: currentState.currentStats,
      updatedMinistries: [],
      cabinetDecisions: [],
      npcActivity: [],
      relationsUpdate: {}
    };
  }
};

export const getDefaultMinistries = (): Ministry[] => [
  { id: 'def', name: 'Savunma Bakanlığı', ministerName: 'Bakan Atandı', role: 'Savunma ve Ordu', morale: 70, budgetShare: 20, efficiency: 80, icon: 'fa-shield-halved' },
  { id: 'eco', name: 'Ekonomi Bakanlığı', ministerName: 'Bakan Atandı', role: 'Maliye ve Hazine', morale: 65, budgetShare: 25, efficiency: 75, icon: 'fa-wallet' },
  { id: 'int', name: 'İçişleri Bakanlığı', ministerName: 'Bakan Atandı', role: 'Güvenlik ve Toplum', morale: 60, budgetShare: 15, efficiency: 70, icon: 'fa-building-shield' },
  { id: 'for', name: 'Dışişleri Bakanlığı', ministerName: 'Bakan Atandı', role: 'Diplomasi', morale: 75, budgetShare: 10, efficiency: 85, icon: 'fa-handshake' },
  { id: 'sci', name: 'Bilim ve Teknoloji', ministerName: 'Bakan Atandı', role: 'Ar-Ge ve Uzay', morale: 80, budgetShare: 5, efficiency: 90, icon: 'fa-microscope' }
];

export const initializeGame = async (countryName: string, playerRole: string): Promise<Report & { updatedMinistries: Partial<Ministry>[], relationsUpdate: Record<string, number> }> => {
  const dummyState: GameState = {
    country: countryName,
    playerRole: playerRole,
    currentDate: "1 Ocak 2026",
    currentStats: { gdp: 500, inflation: 12, unemployment: 9, budgetBalance: -10, armyMorale: 60, publicSupport: 55, stability: 58, techPoints: 50 },
    history: [],
    relations: {},
    ministries: getDefaultMinistries(),
    unlockedTechIds: [],
    stagedDecisions: []
  };
  return processTurn(`2026 yılı için ${countryName} simülasyonunu başlat.`, dummyState);
};
