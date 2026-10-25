import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import type { Character } from '../../gameEngine';
import { Portrait3D } from '../Portrait3D';

interface ThreeDMenuProps {
  characters: Character[];
  title?: string;
  onCharacterSelect?: (character: Character) => void;
  onPreviewImage?: (imageUrl: string) => void;
  className?: string;
  maxSelections?: number;
  allowMultiSelect?: boolean;
  emptyMessage?: string;
}

interface GroupedCharacters {
  [region: string]: Character[];
}

export function ThreeDMenu({
  characters,
  title = "Выбор персонажа",
  onCharacterSelect,
  onPreviewImage,
  className = "",
  maxSelections = 1,
  emptyMessage = "Персонажи не найдены"
}: ThreeDMenuProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const scrollY = useRef(0);

  // Auto-collapse regions when scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      setIsScrolling(true);
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, 300);
    };

    const handleWheel = (e: WheelEvent) => {
      scrollY.current += e.deltaY;
      if (Math.abs(scrollY.current) > 50) {
        setIsScrolling(true);
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
          setIsScrolling(false);
          scrollY.current = 0;
        }, 300);
      }
    };

    const container = document.getElementById('threed-menu-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
      container.addEventListener('wheel', handleWheel, { passive: true });
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
        container.removeEventListener('wheel', handleWheel);
      }
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  // Group characters by region
  const groupedCharacters = useMemo(() => {
    const grouped: GroupedCharacters = {};
    const filtered = characters.filter(char =>
      char.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      char.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      char.regionName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.forEach(char => {
      const region = char.regionName || char.region || 'Неизвестно';
      if (!grouped[region]) {
        grouped[region] = [];
      }
      grouped[region].push(char);
    });

    return grouped;
  }, [characters, searchTerm]);

  const toggleRegion = (region: string) => {
    const newExpanded = new Set(expandedRegions);
    if (newExpanded.has(region)) {
      newExpanded.delete(region);
    } else {
      newExpanded.add(region);
    }
    setExpandedRegions(newExpanded);
  };

  const toggleCharacter = (characterId: string) => {
    const newSelected = new Set(selectedCharacters);
    if (newSelected.has(characterId)) {
      newSelected.delete(characterId);
    } else {
      if (maxSelections === 1) {
        newSelected.clear();
      } else if (newSelected.size >= maxSelections) {
        newSelected.delete(Array.from(newSelected)[0]);
      }
      newSelected.add(characterId);
    }
    setSelectedCharacters(newSelected);
  };

  const getSelectedCharacters = () => {
    return characters.filter(char => selectedCharacters.has(char.id));
  };

  return (
    <div className={`relative w-full max-w-4xl mx-auto ${className}`}
         id="threed-menu-container">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 p-4 mb-4 rounded-t-lg">
        <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
        
        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по имени, роли или региону..."
            className="w-full px-4 py-2 pl-10 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:bg-slate-900/95 transition-all"
          />
          <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>

        {/* Selection Count */}
        {selectedCharacters.size > 0 && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">
              Выбрано: {selectedCharacters.size} {maxSelections === 1 ? '' : `(макс. ${maxSelections})`}
            </span>
            {onCharacterSelect && selectedCharacters.size > 0 && (
              <button
                onClick={() => {
                  const selected = getSelectedCharacters();
                  if (selected.length > 0) {
                    onCharacterSelect(selected[0]);
                  }
                }}
                className="px-3 py-1 bg-purple-700/80 hover:bg-purple-600 text-white text-sm rounded transition-colors"
              >
                {maxSelections === 1 ? 'Использовать' : 'Добавить'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Character Grid */}
      <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {Object.keys(groupedCharacters).length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-400 mb-2">👥</div>
            <p className="text-slate-500 text-sm">{emptyMessage}</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-3 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                Очистить поиск
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {Object.entries(groupedCharacters).map(([region, regionChars]) => (
              <div key={region} className="rounded-lg border border-slate-800 bg-slate-950/50 overflow-hidden">
                <button
                  onClick={() => toggleRegion(region)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all duration-200
                    ${isScrolling ? 'bg-slate-900/50' : 'hover:bg-purple-500/10'}
                    ${expandedRegions.has(region) ? 'bg-purple-500/10' : ''}`}
                >
                  <span className="text-sm font-semibold text-white">{region}</span>
                  <span className="text-xs text-slate-400 ml-2">({regionChars.length})</span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform duration-200
                      ${expandedRegions.has(region) ? 'rotate-180' : ''}`}
                  />
                </button>
                
                {expandedRegions.has(region) && (
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {regionChars.map((char) => {
                      const isSelected = selectedCharacters.has(char.id);
                      const isModelAvailable = char.model3d && char.model3d !== undefined;
                      
                      return (
                        <button
                          key={char.id}
                          onClick={() => toggleCharacter(char.id)}
                          className={`relative group p-2 rounded-lg border transition-all duration-200
                            ${isSelected
                              ? 'border-purple-500/60 bg-purple-500/10 scale-105'
                              : 'border-slate-800 bg-slate-950/80 hover:border-slate-600 hover:bg-slate-900/50'
                            }
                            ${!isModelAvailable ? 'opacity-60' : ''}
                            ${isScrolling ? 'pointer-events-none' : ''}
                          `}
                        >
                          {/* 3D Portrait */}
                          <div className="relative h-20 w-16 mx-auto mb-2 overflow-hidden rounded-md border border-slate-700 bg-slate-900">
                            <Portrait3D
                              model={char.model3d}
                              poster={char.image}
                              alt={char.name}
                              className="h-full w-full object-cover"
                              onPreviewImage={onPreviewImage}
                            />
                            
                            {/* Selection Indicator */}
                            <div className="absolute top-1 right-1">
                              {isSelected && (
                                <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                  <span className="text-[10px] text-white font-bold">✓</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Character Info */}
                          <div className="text-center">
                            <p className="text-xs font-medium text-white truncate mb-0.5" title={char.name}>
                              {char.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate" title={char.role}>
                              {char.role}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {char.age} лет · {char.skill} навык
                            </p>
                          </div>
                          
                          {/* 3D Badge */}
                          {isModelAvailable && (
                            <div className="absolute bottom-1 left-1">
                              <span className="px-1.5 py-0.5 bg-blue-600/80 text-white text-[9px] rounded font-medium">
                                3D
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
