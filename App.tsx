
import React, { useState, useEffect, useRef } from 'react';
import { GameState, GameView, Report, Ministry, Decision, Technology } from './types';
import { initializeGame, processTurn, getDefaultMinistries } from './services/geminiService';
import StatCard from './components/StatCard';
import Terminal from './components/Terminal';

const SAVE_KEY = "modern_world_save_v2.5";

const ROLES = [
  { id: 'Cumhurbaşkanı', desc: 'Genel strateji ve kabine yönetimi.', icon: 'fa-crown', color: 'text-yellow-500', theme: 'border-yellow-500', bg: 'bg-yellow-600' },
  { id: 'Mareşal', desc: 'Milli savunma ve askeri harekatlar.', icon: 'fa-shield-halved', color: 'text-red-500', theme: 'border-red-500', bg: 'bg-red-600' },
  { id: 'Ekonomi Bakanı', desc: 'Maliye, hazine ve ticaret politikaları.', icon: 'fa-chart-line', color: 'text-green-500', theme: 'border-green-500', bg: 'bg-green-600' },
  { id: 'Dışişleri Bakanı', desc: 'Uluslararası ilişkiler ve diplomasi.', icon: 'fa-handshake', color: 'text-blue-500', theme: 'border-blue-500', bg: 'bg-blue-600' },
  { id: 'Bilim Bakanı', desc: 'Ar-Ge, teknoloji ve gelecek vizyonu.', icon: 'fa-microscope', color: 'text-purple-500', theme: 'border-purple-500', bg: 'bg-purple-600' }
];

const INITIAL_TECHS: Technology[] = [
  { id: 'cyber_def', name: 'Siber Kalkan', description: 'Gelişmiş ulusal güvenlik duvarı.', cost: 40, category: 'Military', benefit: '+10 İstikrar, Siber krizlere karşı bağışıklık.', unlocked: false, icon: 'fa-user-shield' },
  { id: 'green_energy', name: 'Yeşil Dönüşüm', description: 'Yenilenebilir enerji altyapısı.', cost: 35, category: 'Economic', benefit: '+5% GSYH, Uzun vadeli enflasyon düşüşü.', unlocked: false, icon: 'fa-leaf' },
  { id: 'ai_gov', name: 'Yapay Zeka Yönetimi', description: 'Bürokraside AI entegrasyonu.', cost: 50, category: 'Social', benefit: '+15 Bakanlık Verimliliği.', unlocked: false, icon: 'fa-brain' },
  { id: 'stealth_tech', name: 'Hayalet Filo', description: 'Düşman radarlarında görünmezlik.', cost: 60, category: 'Military', benefit: '+15 Ordu Morali, Gizli operasyon başarısı.', unlocked: false, icon: 'fa-plane-up' },
  { id: 'fintech_hub', name: 'Global Finans Merkezi', description: 'Dijital bankacılık devrimi.', cost: 45, category: 'Economic', benefit: '+10% Bütçe Dengesi.', unlocked: false, icon: 'fa-coins' },
  { id: 'universal_edu', name: 'Dijital Akademi', description: 'Herkes için yüksek kaliteli online eğitim.', cost: 30, category: 'Social', benefit: '+10 Halk Desteği.', unlocked: false, icon: 'fa-graduation-cap' }
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState<GameView>(GameView.DASHBOARD);
  const [error, setError] = useState<string | null>(null);
  const [pendingCountry, setPendingCountry] = useState('Türkiye');
  const [selectedRoleId, setSelectedRoleId] = useState(ROLES[0].id);
  const [terminalDraft, setTerminalDraft] = useState('');
  
  const terminalRef = useRef<{ focus: () => void }>(null);

  const currentRole = ROLES.find(r => r.id === (gameState?.playerRole || selectedRoleId)) || ROLES[0];

  const handleInit = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await initializeGame(pendingCountry, selectedRoleId);
      const ministries = getDefaultMinistries().map(m => {
        const update = result.updatedMinistries?.find(um => um.id === m.id);
        return update ? { ...m, ...update } : m;
      });

      const initialState: GameState = {
        country: pendingCountry,
        playerRole: selectedRoleId,
        currentDate: result.date || "1 Ocak 2026",
        currentStats: result.statsSnapshot,
        history: [result],
        relations: result.relationsUpdate || {},
        ministries: ministries,
        unlockedTechIds: [],
        stagedDecisions: []
      };
      
      setGameState(initialState);
      localStorage.setItem(SAVE_KEY, JSON.stringify(initialState));
    } catch (err: any) {
      setError("Dostum, motoru çalıştıramadık.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommand = async (command: string) => {
    if (!gameState || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await processTurn(command, gameState);
      setGameState(prev => {
        if (!prev) return null;
        const updatedMinistries = prev.ministries.map(m => {
          const update = result.updatedMinistries?.find(um => um.id === m.id);
          const npcAction = result.npcActivity?.find(na => na.ministerId === m.id);
          return {
            ...m,
            ...(update || {}),
            automatedActions: npcAction ? [...(m.automatedActions || []), npcAction.action].slice(-3) : m.automatedActions
          };
        });
        const newState = {
          ...prev,
          currentDate: result.date,
          currentStats: result.statsSnapshot,
          history: [result, ...prev.history].slice(0, 30),
          relations: { ...prev.relations, ...result.relationsUpdate },
          ministries: updatedMinistries,
          stagedDecisions: []
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(newState));
        return newState;
      });
      setTerminalDraft('');
    } catch (err: any) {
      setError("Emir işlenirken bir sorun çıktı.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = (decision: Decision, option: any, status: 'approved' | 'rejected' = 'approved') => {
    if (!gameState) return;
    
    // Check if decision already staged
    if (gameState.stagedDecisions.find(sd => sd.decisionTitle === decision.title)) return;

    setGameState(prev => prev ? ({
      ...prev,
      stagedDecisions: [...prev.stagedDecisions, { 
        decisionTitle: decision.title, 
        selectedOption: status === 'rejected' ? 'REDDEDİLDİ (VETO)' : option.label 
      }]
    }) : null);
  };

  const handleIntervene = (issue: string) => {
    setTerminalDraft(`MÜDAHALE [${issue}]: `);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleUnlockTech = (tech: Technology) => {
    if (!gameState || gameState.unlockedTechIds.includes(tech.id)) return;
    const techPoints = gameState.currentStats.techPoints || 0;
    if (techPoints < tech.cost) {
      setError(`Yetersiz Ar-Ge Puanı!`);
      return;
    }

    setGameState(prev => prev ? ({
      ...prev,
      unlockedTechIds: [...prev.unlockedTechIds, tech.id],
      currentStats: { ...prev.currentStats, techPoints: techPoints - tech.cost },
      stagedDecisions: [...prev.stagedDecisions, { decisionTitle: `Ar-Ge: ${tech.name}`, selectedOption: "Aktif Edildi" }]
    }) : null);
  };

  if (!gameState) {
    const hasSave = localStorage.getItem(SAVE_KEY) !== null;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#020617]">
        <div className="max-w-4xl w-full glass p-12 rounded-[2.5rem] shadow-2xl space-y-10 border-t-4 border-blue-500">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-br from-white via-blue-400 to-blue-800 bg-clip-text text-transparent italic">MODERN WORLD</h1>
            <p className="text-slate-500 text-xs uppercase tracking-[0.5em] font-bold">Global Sandbox Strategy</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <input 
                type="text" value={pendingCountry} onChange={(e) => setPendingCountry(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 outline-none focus:border-blue-500/50 text-xl font-bold"
                placeholder="Ülke ismi..."
              />
              <button 
                onClick={handleInit} disabled={isLoading}
                className="w-full bg-blue-600 py-5 rounded-2xl font-black text-white shadow-2xl hover:bg-blue-500 transition-all uppercase tracking-widest"
              >
                {isLoading ? 'SİSTEM BAŞLATILIYOR...' : 'YENİ SİSTEM KUR'}
              </button>
              {hasSave && (
                <button onClick={() => setGameState(JSON.parse(localStorage.getItem(SAVE_KEY)!))} className="w-full bg-slate-900 py-5 rounded-2xl font-bold text-slate-300 border border-slate-800">
                  KAYITTAN DEVAM ET
                </button>
              )}
            </div>
            <div className="space-y-4">
               <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                 {ROLES.map(role => (
                   <div key={role.id} onClick={() => setSelectedRoleId(role.id)} className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-center gap-5 ${selectedRoleId === role.id ? `bg-blue-500/10 ${role.theme}` : 'bg-slate-900/30 border-slate-800'}`}>
                     <div className={`w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-xl ${role.color}`}><i className={`fas ${role.icon}`}></i></div>
                     <div><h4 className="font-bold text-sm">{role.id}</h4></div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const latestReport = gameState.history[0];

  return (
    <div className={`min-h-screen flex flex-col max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700 pb-20`}>
      <header className={`flex flex-col md:flex-row md:items-center justify-between gap-6 glass p-8 rounded-3xl border-l-[6px] ${currentRole.theme} shadow-2xl`}>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <span className={`text-[10px] ${currentRole.bg} text-white px-3 py-1 rounded-full font-black uppercase tracking-tighter`}>{gameState.playerRole}</span>
             <span className="text-[10px] bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-black uppercase tracking-tighter">{gameState.country} HQ</span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Harekat Merkezi</h1>
          <p className="text-slate-500 text-xs mono uppercase">GÜNCEL TARİH: {gameState.currentDate}</p>
        </div>

        <nav className="flex bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shadow-inner overflow-x-auto">
          {[
            { id: GameView.DASHBOARD, label: 'DURUM', icon: 'fa-gauge-high' },
            { id: GameView.CABINET, label: 'KABİNE', icon: 'fa-users-gear' },
            { id: GameView.TECH, label: 'AR-GE', icon: 'fa-microscope' },
            { id: GameView.DIPLOMACY, label: 'DİPLOMASİ', icon: 'fa-globe' },
            { id: GameView.HISTORY, label: 'ARŞİV', icon: 'fa-box-archive' }
          ].map(view => (
            <button 
              key={view.id} onClick={() => setActiveView(view.id as GameView)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest whitespace-nowrap ${activeView === view.id ? `${currentRole.bg} text-white shadow-xl scale-105` : 'text-slate-500 hover:text-slate-300'}`}
            >
              <i className={`fas ${view.icon}`}></i> {view.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard label="GSYH" value={gameState.currentStats.gdp} suffix="B$" icon="fa-chart-line" color="bg-blue-500" />
        <StatCard label="Enflasyon" value={gameState.currentStats.inflation} suffix="%" icon="fa-arrow-trend-up" color="bg-red-500" />
        <StatCard label="Bütçe" value={gameState.currentStats.budgetBalance} suffix="B$" icon="fa-vault" color="bg-green-500" />
        <StatCard label="Ordu" value={gameState.currentStats.armyMorale} suffix="/100" icon="fa-jet-fighter" color="bg-indigo-500" />
        <StatCard label="Halk" value={gameState.currentStats.publicSupport} suffix="/100" icon="fa-users" color="bg-pink-500" />
        <StatCard label="İstikrar" value={gameState.currentStats.stability} suffix="/100" icon="fa-landmark" color="bg-teal-500" />
        <StatCard label="Ar-Ge" value={gameState.currentStats.techPoints || 0} suffix=" TP" icon="fa-atom" color="bg-purple-500" />
      </div>

      <main className="flex-1">
        {activeView === GameView.DASHBOARD && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section className={`glass p-8 rounded-[2.5rem] relative border-t-2 ${currentRole.theme} shadow-2xl overflow-hidden`}>
                <div className="absolute top-0 right-0 p-8 opacity-5 text-6xl"><i className="fas fa-quote-right"></i></div>
                <h2 className="text-xl font-black mb-6 flex items-center gap-3"><i className={`fas fa-comment-dots ${currentRole.color}`}></i> BAŞDANIŞMAN ANALİZİ</h2>
                <div className="text-slate-300 leading-relaxed text-sm space-y-4 font-medium italic relative z-10">"{latestReport.summary}"</div>
              </section>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass p-8 rounded-[2rem] border-l-4 border-l-orange-600 space-y-6">
                  <h3 className="font-black text-[10px] text-orange-500 uppercase tracking-widest flex justify-between items-center">
                    BEKLEYEN KRİTİK SORUNLAR
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]"></span>
                  </h3>
                  <div className="space-y-4">
                    {latestReport.pendingIssues.map((issue, i) => {
                      const isIntervened = terminalDraft.includes(`[${issue}]`);
                      return (
                        <div key={i} className={`group bg-slate-950/50 p-4 rounded-2xl border transition-all ${isIntervened ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'border-slate-800 hover:border-slate-700'}`}>
                          <div className="flex items-start gap-4">
                            <i className="fas fa-triangle-exclamation text-orange-600 mt-1"></i>
                            <div className="flex-1">
                              <p className="text-[11px] font-bold text-slate-300 leading-tight mb-3">{issue}</p>
                              <button 
                                onClick={() => handleIntervene(issue)}
                                className={`text-[9px] font-black px-4 py-2 rounded-lg transition-all uppercase tracking-widest ${isIntervened ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-orange-600 hover:text-white'}`}
                              >
                                {isIntervened ? 'PLAN HAZIRLANIYOR...' : 'MÜDAHALE PLANI YAZ'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {latestReport.pendingIssues.length === 0 && <p className="text-[10px] text-slate-600 italic">Ülke sınırları dahilinde rapor edilmiş bir kriz bulunmuyor.</p>}
                  </div>
                </div>
                <div className="glass p-8 rounded-[2rem] border-l-4 border-l-blue-600 space-y-4">
                  <h3 className="font-black text-[10px] text-blue-500 uppercase tracking-widest">GİZLİ İSTİHBARAT</h3>
                  <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 relative">
                    <div className="absolute top-2 right-4 text-[8px] text-blue-500/30 font-mono">EYES ONLY</div>
                    <p className="text-[11px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">{latestReport.intelligence}</p>
                  </div>
                </div>
              </div>

              {gameState.stagedDecisions.length > 0 && (
                <div className={`glass p-8 rounded-[2rem] border-2 ${currentRole.theme} animate-in slide-in-from-left duration-300`}>
                  <h3 className="text-xs font-black mb-4 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-satellite-dish animate-pulse"></i> ONAYLANAN EMİRLER (HAREKAT PLANI)
                  </h3>
                  <div className="space-y-2">
                    {gameState.stagedDecisions.map((sd, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] bg-slate-950/80 p-3 rounded-xl border border-white/5">
                        <span className="text-slate-500 font-bold">{sd.decisionTitle}</span>
                        <span className={`font-black uppercase ${sd.selectedOption.includes('REDDEDİLDİ') ? 'text-red-500' : 'text-blue-400'}`}>
                          {sd.selectedOption}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-8">
              <button 
                onClick={() => handleCommand("Sonraki Tur")} 
                disabled={isLoading}
                className={`w-full py-8 rounded-[2rem] font-black text-2xl uppercase tracking-tighter transition-all shadow-[0_20px_50px_rgba(30,64,175,0.3)] ${isLoading ? 'bg-slate-800 text-slate-500' : `${currentRole.bg} text-white hover:scale-[1.03] active:scale-95`}`}
              >
                {isLoading ? <i className="fas fa-circle-notch animate-spin"></i> : "TURU TAMAMLA"}
              </button>

              <section className="glass p-8 rounded-[2.5rem] border-t-2 border-t-purple-600 shadow-2xl">
                <h2 className="text-[10px] font-black mb-6 uppercase tracking-widest text-purple-500 flex justify-between">
                  KABİNE GÜNDEMİ
                  <i className="fas fa-gavel"></i>
                </h2>
                <div className="space-y-6">
                  {latestReport.cabinetDecisions?.map((dec, i) => {
                    const staged = gameState.stagedDecisions.find(sd => sd.decisionTitle === dec.title);
                    return (
                      <div key={i} className={`p-6 bg-slate-950/80 rounded-[2rem] border transition-all ${staged ? (staged.selectedOption.includes('REDDEDİLDİ') ? 'border-red-500/30' : 'border-green-500/30') : 'border-slate-800 hover:border-slate-700'}`}>
                        <div className="flex justify-between items-start mb-3">
                           <h4 className="font-black text-sm tracking-tight text-slate-200">{dec.title}</h4>
                           {staged && (
                             <i className={`fas ${staged.selectedOption.includes('REDDEDİLDİ') ? 'fa-ban text-red-500' : 'fa-check-circle text-green-500'} animate-in zoom-in`}></i>
                           )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed mb-5 italic">"{dec.description}"</p>
                        
                        {!staged ? (
                          <div className="flex flex-col gap-2">
                            {dec.options.map((opt, j) => (
                              <button 
                                key={j} 
                                onClick={() => handleDecision(dec, opt)} 
                                disabled={isLoading}
                                className="text-left p-4 rounded-xl border border-slate-800 bg-slate-900/50 text-[10px] font-black uppercase hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                              >
                                {opt.label}
                              </button>
                            ))}
                            <button 
                              onClick={() => handleDecision(dec, null, 'rejected')}
                              className="mt-2 w-full p-3 rounded-xl border border-red-900/30 bg-red-900/10 text-red-500 text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"
                            >
                              <i className="fas fa-times-circle mr-2"></i> TÜM SEÇENEKLERİ VETO ET
                            </button>
                          </div>
                        ) : (
                          <div className={`p-3 rounded-xl text-center text-[9px] font-black uppercase border ${staged.selectedOption.includes('REDDEDİLDİ') ? 'bg-red-900/20 border-red-500/20 text-red-400' : 'bg-green-900/20 border-green-500/20 text-green-400'}`}>
                            {staged.selectedOption}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(!latestReport.cabinetDecisions || latestReport.cabinetDecisions.length === 0) && (
                    <div className="text-center py-8 opacity-20">
                      <i className="fas fa-calendar-check text-3xl mb-2"></i>
                      <p className="text-[10px] font-black">BUGÜNLÜK GÜNDEM TAMAMLANDI</p>
                    </div>
                  )}
                </div>
              </section>
              <Terminal 
                onSubmit={handleCommand} 
                isLoading={isLoading} 
                country={gameState.country} 
                initialValue={terminalDraft}
              />
            </div>
          </div>
        )}

        {activeView === GameView.TECH && (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <div className={`flex items-center justify-between glass p-8 rounded-[2rem] border-b-4 ${currentRole.theme} shadow-2xl`}>
               <div>
                 <h2 className="text-3xl font-black uppercase tracking-tighter italic">Ulusal Teknoloji Matrisi</h2>
                 <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Stratejik Üstünlük ve Ar-Ge Paneli</p>
               </div>
               <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 text-right shadow-inner">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MEVCUT PUAN</span>
                 <div className="text-4xl font-black text-purple-500 tracking-tighter">{gameState.currentStats.techPoints || 0} <span className="text-xs">TP</span></div>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {INITIAL_TECHS.map(tech => {
                const isUnlocked = gameState.unlockedTechIds.includes(tech.id);
                const canAfford = (gameState.currentStats.techPoints || 0) >= tech.cost;
                return (
                  <div key={tech.id} className={`glass p-8 rounded-[2.5rem] border-2 transition-all group relative overflow-hidden ${isUnlocked ? 'border-green-500/50 bg-green-500/[0.03]' : 'border-slate-800 hover:border-purple-500/50'}`}>
                    {isUnlocked && <div className="absolute top-0 right-0 p-4 text-green-500/20 text-4xl"><i className="fas fa-check-double"></i></div>}
                    <div className="flex justify-between items-start mb-8">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border shadow-2xl transition-transform group-hover:scale-110 ${isUnlocked ? 'bg-green-600 text-white border-green-400' : 'bg-slate-950 text-purple-500 border-slate-800'}`}>
                        <i className={`fas ${tech.icon}`}></i>
                      </div>
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border ${tech.category === 'Military' ? 'bg-red-500/10 text-red-500 border-red-500/20' : tech.category === 'Economic' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                        {tech.category}
                      </span>
                    </div>
                    <h3 className="text-xl font-black mb-3 tracking-tight text-slate-100">{tech.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-8 h-12 overflow-hidden italic">"{tech.description}"</p>
                    <div className="p-5 bg-slate-950/80 rounded-2xl border border-slate-800 mb-8 shadow-inner">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">OPERASYONEL AVANTAJ:</span>
                      <p className="text-[11px] text-purple-400 font-bold leading-tight">{tech.benefit}</p>
                    </div>
                    <button 
                      onClick={() => handleUnlockTech(tech)}
                      disabled={isUnlocked || !canAfford || isLoading}
                      className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${isUnlocked ? 'bg-green-600 text-white cursor-default' : canAfford ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-xl' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                    >
                      {isUnlocked ? 'SİSTEM AKTİF' : canAfford ? `${tech.cost} TP - PROTOKOLÜ BAŞLAT` : `${tech.cost} TP GEREKLİ`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeView === GameView.CABINET && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in zoom-in duration-500">
            {gameState.ministries.map(m => (
              <div key={m.id} className="glass p-10 rounded-[3rem] hover:border-blue-500/30 transition-all group relative overflow-hidden shadow-2xl">
                <div className="absolute -right-6 -top-6 text-slate-800/10 text-9xl group-hover:rotate-12 transition-transform duration-700"><i className={`fas ${m.icon}`}></i></div>
                <div className="flex items-center gap-6 relative z-10 mb-10">
                  <div className={`w-20 h-20 bg-slate-950 rounded-[1.5rem] flex items-center justify-center text-4xl ${currentRole.color} border border-slate-800 shadow-2xl transition-transform group-hover:-translate-y-1`}><i className={`fas ${m.icon}`}></i></div>
                  <div>
                    <h3 className="font-black text-lg tracking-tight uppercase text-slate-200">{m.name}</h3>
                    <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800 mt-2">{m.ministerName}</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-500"><span>OPERASYONEL MORAL</span><span>%{m.morale}</span></div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden shadow-inner border border-white/5">
                      <div className={`h-full ${currentRole.bg} transition-all duration-1000 shadow-[0_0_10px_rgba(30,64,175,0.5)]`} style={{ width: `${m.morale}%` }}></div>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-slate-800/50">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">SON FAALİYETLER:</span>
                    <div className="space-y-2">
                      {m.automatedActions?.map((a, i) => (
                        <div key={i} className="text-[10px] text-slate-400 italic bg-slate-950/50 p-3 rounded-xl border border-white/5">- {a}</div>
                      )) || <span className="text-[10px] text-slate-600 italic">Bakanlık rutin faaliyetlerini sürdürüyor.</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-16 text-slate-800 text-[10px] font-black uppercase tracking-[0.8em] opacity-40">
        MODERN WORLD v2.5 • ENGINE BY GEMINI-3-FLASH • ALL SYSTEMS NOMINAL
      </footer>
    </div>
  );
};

export default App;
