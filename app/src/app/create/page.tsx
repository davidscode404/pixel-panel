'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { buildApiUrl, API_CONFIG } from '../../config/api';

interface Panel {
  id: number;
  isZoomed: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  smallCanvasData: string | null; // base64 data URL for small canvas
  largeCanvasData: string | null; // base64 data URL for large canvas
}

export default function CreatePage() {
  const [panels, setPanels] = useState<Panel[]>([
    { id: 1, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null },
    { id: 2, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null },
    { id: 3, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null },
    { id: 4, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null },
    { id: 5, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null },
    { id: 6, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null },
  ]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [brushSize, setBrushSize] = useState(3);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [textPrompt, setTextPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [comicTitle, setComicTitle] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Load comic for editing if one is selected via URL parameter
  useEffect(() => {
    const loadComicFromURL = async () => {
      // Check for comic parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const comicTitle = urlParams.get('comic');
      
      if (comicTitle) {
        try {
          console.log(`Loading comic from URL parameter: ${comicTitle}`);
          
          // Load comic data from backend
          const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.LOAD_COMIC}/${comicTitle}`));
          if (response.ok) {
            const comic = await response.json();
            // Format the comic title for display
            const formattedTitle = comic.comic_title
              .replace(/_/g, ' ')
              .split(' ')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
            setComicTitle(formattedTitle);
            setIsEditing(true);
            
            // Load the comic panels from project directory
            if (comic.panels) {
              const updatedPanels = panels.map(panel => {
                const savedPanel = comic.panels.find((p: any) => p.id === panel.id);
                if (savedPanel && savedPanel.image_data) {
                  return {
                    ...panel,
                    smallCanvasData: savedPanel.image_data,
                    largeCanvasData: savedPanel.image_data
                  };
                }
                return panel;
              });
              
              setPanels(updatedPanels);
              
              // After setting the panel data, draw the images onto the canvases
              setTimeout(() => {
                console.log('Loading panels onto canvases...');
                comic.panels.forEach((savedPanel: any) => {
                  if (savedPanel.image_data) {
                    const panel = updatedPanels.find(p => p.id === savedPanel.id);
                    if (panel && panel.canvasRef.current) {
                      const canvas = panel.canvasRef.current;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        console.log(`Loading panel ${savedPanel.id} onto canvas`);
                        const img = new Image();
                        img.onload = () => {
                          console.log(`Drawing panel ${savedPanel.id} onto canvas`);
                          ctx.clearRect(0, 0, canvas.width, canvas.height);
                          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        };
                        img.onerror = (error) => {
                          console.error(`Error loading image for panel ${savedPanel.id}:`, error);
                        };
                        img.src = savedPanel.image_data;
                      } else {
                        console.error(`Could not get context for panel ${savedPanel.id}`);
                      }
                    } else {
                      console.error(`Canvas not found for panel ${savedPanel.id}`);
                    }
                  }
                });
              }, 200);
            }
            
            // Clean up URL parameter
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            alert(`Failed to load comic: ${errorData.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Error loading comic:', error);
          alert(`Failed to load comic: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };
    
    loadComicFromURL();
  }, []);

  const saveCanvasState = (panelId: number, isLargeCanvas: boolean = false) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    const canvas = panel.canvasRef.current;
    const dataURL = canvas.toDataURL();
    
    console.log(`Saving ${isLargeCanvas ? 'large' : 'small'} canvas data for panel ${panelId}:`, dataURL.substring(0, 50) + '...');
    
    setPanels(prev => prev.map(p => 
      p.id === panelId 
        ? { 
            ...p, 
            [isLargeCanvas ? 'largeCanvasData' : 'smallCanvasData']: dataURL 
          } 
        : p
    ));
  };

  const restoreCanvasState = (panelId: number, isLargeCanvas: boolean = false) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    const canvas = panel.canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataURL = isLargeCanvas ? panel.largeCanvasData : panel.smallCanvasData;
    if (!dataURL) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataURL;
  };

  const handlePanelClick = (panelId: number) => {
    const panel = panels.find(p => p.id === panelId);
    
    if (panel?.isZoomed) {
      // Save current large canvas state before zooming out
      saveCanvasState(panelId, true);
      // Update the small canvas preview
      updateSmallCanvasPreview(panelId);
    }

    setPanels(prev => prev.map(p => ({
      ...p,
      isZoomed: p.id === panelId ? !p.isZoomed : false
    })));

    // If zooming in, restore the saved large canvas state after a brief delay
    if (!panel?.isZoomed) {
      setTimeout(() => {
        restoreCanvasState(panelId, true);
      }, 100);
    } else {
      // If zooming out, restore small canvas previews
      setTimeout(() => {
        forceRestoreSmallCanvases();
      }, 100);
    }
  };

  // Restore small canvas data when returning to grid view
  useEffect(() => {
    const zoomedPanel = panels.find(p => p.isZoomed);
    if (!zoomedPanel) {
      // We're in grid view, restore small canvas data
      panels.forEach(panel => {
        if (panel.smallCanvasData && panel.canvasRef.current) {
          const canvas = panel.canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = panel.smallCanvasData;
          }
        }
      });
    }
  }, [panels.map(p => p.isZoomed).join(',')]);

  // Restore canvas data when panels are loaded from saved comic
  useEffect(() => {
    // Check if we have panels with data but no canvas content
    const panelsWithData = panels.filter(panel => panel.smallCanvasData && panel.canvasRef.current);
    if (panelsWithData.length > 0) {
      panelsWithData.forEach(panel => {
        const canvas = panel.canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Check if canvas is empty
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const isEmpty = imageData.data.every(pixel => pixel === 0);
            
            if (isEmpty && panel.smallCanvasData) {
              console.log(`Restoring canvas for panel ${panel.id}`);
              const img = new Image();
              img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              };
              img.src = panel.smallCanvasData;
            }
          }
        }
      });
    }
  }, [panels]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, panelId: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    const canvas = panel.canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize;
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, panelId: number) => {
    if (!isDrawing) return;

    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    const canvas = panel.canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = (panelId: number) => {
    setIsDrawing(false);
    // Save canvas state after drawing
    const zoomedPanel = panels.find(panel => panel.isZoomed);
    if (zoomedPanel && zoomedPanel.id === panelId) {
      // We're drawing on the large canvas - save both large and small preview
      saveCanvasState(panelId, true);
      // Also update the small canvas preview
      updateSmallCanvasPreview(panelId);
    } else {
      // We're drawing on a small canvas in grid view - just save small
      saveCanvasState(panelId, false);
    }
  };

  const updateSmallCanvasPreview = (panelId: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    const canvas = panel.canvasRef.current;
    const dataURL = canvas.toDataURL();
    
    // Update the small canvas preview
    setPanels(prev => prev.map(p => 
      p.id === panelId ? { ...p, smallCanvasData: dataURL } : p
    ));
  };

  // Force restore small canvas data when returning to grid view
  const forceRestoreSmallCanvases = () => {
    console.log('Force restoring small canvases...');
    panels.forEach(panel => {
      if (panel.smallCanvasData && panel.canvasRef.current) {
        console.log(`Restoring small canvas for panel ${panel.id}:`, panel.smallCanvasData.substring(0, 50) + '...');
        const canvas = panel.canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            console.log(`Restored small canvas for panel ${panel.id}`);
          };
          img.src = panel.smallCanvasData;
        }
      } else {
        console.log(`No small canvas data for panel ${panel.id}`);
      }
    });
  };

  const handleToolChange = (tool: string) => {
    setCurrentTool(tool);
    // Reset composite operation for all canvases
    panels.forEach(panel => {
      if (panel.canvasRef.current) {
        const ctx = panel.canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    });
  };

  const clearPanel = (panelId: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    const canvas = panel.canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update panel data to reflect cleared state
    setPanels(prev => prev.map(p => 
      p.id === panelId 
        ? { ...p, smallCanvasData: null, largeCanvasData: null }
        : p
    ));
    
    // Check if all panels are now empty and reset context if so
    checkAndResetContext();
  };

  const checkAndResetContext = async () => {
    // Check if all panels are empty
    const allPanelsEmpty = panels.every(panel => 
      !panel.smallCanvasData && !panel.largeCanvasData
    );
    
    if (allPanelsEmpty) {
      try {
        console.log('All panels cleared, resetting context...');
        const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RESET_CONTEXT), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          console.log('Context reset successfully');
        } else {
          console.error('Failed to reset context');
        }
      } catch (error) {
        console.error('Error resetting context:', error);
      }
    }
  };

  const clearAllPanels = () => {
    panels.forEach(panel => {
      if (panel.canvasRef.current) {
        const canvas = panel.canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    });
    
    // Reset all panel data
    setPanels(prev => prev.map(panel => ({
      ...panel,
      smallCanvasData: null,
      largeCanvasData: null
    })));
    
    // Reset context
    checkAndResetContext();
  };

  const saveComic = async () => {
    if (!comicTitle.trim()) {
      alert('Please enter a comic title');
      return;
    }

    console.log('Starting to save comic:', comicTitle);

    // Collect all panel data
    const comicData = {
      id: isEditing ? comicTitle : Date.now(),
      title: comicTitle,
      date: new Date().toISOString(),
      panels: panels.map(panel => ({
        id: panel.id,
        smallCanvasData: panel.smallCanvasData,
        largeCanvasData: panel.largeCanvasData
      }))
    };

    console.log('Comic data prepared:', comicData);

    try {
      // Save each panel as PNG to project directory
      console.log('Saving panels to project directory...');
      await savePanelsAsPNG(comicTitle);
      console.log('PNG save successful');

      alert(`Comic "${comicTitle}" saved successfully!`);
      setComicTitle('');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving comic:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      alert(`Failed to save comic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const savePanelsAsPNG = async (title: string) => {
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    try {
      // Send each panel to backend to save in project directory
      for (const panel of panels) {
        if (panel.largeCanvasData) {
          console.log(`Saving panel ${panel.id} to project directory...`);
          
          // Extract base64 data
          const base64Data = panel.largeCanvasData.split(',')[1];
          
          // Send to backend to save in project directory
          const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SAVE_PANEL), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              comic_title: safeTitle,
              panel_id: panel.id,
              image_data: base64Data
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to save panel ${panel.id}`);
          }
          
          console.log(`Panel ${panel.id} saved to project directory successfully`);
        } else {
          console.log(`Panel ${panel.id} has no data to save`);
        }
      }
    } catch (error) {
      console.error('Error saving PNG files:', error);
      throw new Error(`Failed to save PNG files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // IndexedDB functions
  const saveComicToDB = async (comicData: any) => {
    return new Promise((resolve, reject) => {
      console.log('Opening IndexedDB...');
      const request = indexedDB.open('ComicDatabase', 1);
      
      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };
      
      request.onsuccess = () => {
        console.log('IndexedDB opened successfully');
        const db = request.result;
        const transaction = db.transaction(['comics'], 'readwrite');
        const store = transaction.objectStore('comics');
        
        console.log('Putting data into store...');
        const putRequest = store.put(comicData);
        putRequest.onsuccess = () => {
          console.log('Data saved to IndexedDB successfully');
          resolve(putRequest.result);
        };
        putRequest.onerror = () => {
          console.error('IndexedDB put error:', putRequest.error);
          reject(new Error(`Failed to save data: ${putRequest.error?.message}`));
        };
      };
      
      request.onupgradeneeded = () => {
        console.log('IndexedDB upgrade needed, creating store...');
        const db = request.result;
        if (!db.objectStoreNames.contains('comics')) {
          const store = db.createObjectStore('comics', { keyPath: 'id' });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('date', 'date', { unique: false });
          console.log('Object store created successfully');
        }
      };
    });
  };

  const generateComicArt = async (panelId: number) => {
    if (!textPrompt.trim()) {
      alert('Please enter a text prompt');
      return;
    }

    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    setIsGenerating(true);
    
    try {
      // Get canvas data as base64
      const canvas = panel.canvasRef.current;
      const canvasData = canvas.toDataURL('image/png');
      const base64Data = canvasData.split(',')[1]; // Remove data:image/png;base64, prefix

      // Call backend API
      console.log(`🚀 Generating comic art for panel ${panelId} with prompt: ${textPrompt.substring(0, 50)}...`);
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.GENERATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text_prompt: textPrompt,
          reference_image: base64Data,
          panel_id: panelId
        })
      });

      const result = await response.json();

      if (result.success) {
        // Load the generated image onto the canvas
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Calculate scaling to fit the canvas while maintaining aspect ratio
            const canvasAspect = canvas.width / canvas.height;
            const imgAspect = img.width / img.height;
            
            let drawWidth, drawHeight, offsetX, offsetY;
            
            if (imgAspect > canvasAspect) {
              // Image is wider than canvas - fit to width
              drawWidth = canvas.width;
              drawHeight = canvas.width / imgAspect;
              offsetX = 0;
              offsetY = (canvas.height - drawHeight) / 2;
            } else {
              // Image is taller than canvas - fit to height
              drawHeight = canvas.height;
              drawWidth = canvas.height * imgAspect;
              offsetX = (canvas.width - drawWidth) / 2;
              offsetY = 0;
            }
            
            // Draw the image centered and scaled to fit
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            
            // Save the new state
            saveCanvasState(panelId, true);
            updateSmallCanvasPreview(panelId);
          }
        };
        img.src = `data:image/png;base64,${result.image_data}`;
      } else {
        alert(`Error generating comic art: ${result.error}`);
      }
    } catch (error) {
      console.error('Error generating comic art:', error);
      alert('Failed to generate comic art. Make sure the backend server is running.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAudio = async () => {
    // Check if this is the kan_vibe comic
    if (comicTitle.toLowerCase().includes('kan') || comicTitle.toLowerCase().includes('vibe')) {
      setIsGeneratingAudio(true);
      
      try {
        // Simulate loading time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create audio element and play the kanban_audio.mp3
        const audio = new Audio('/saved-comics/kan_vibe/kanban_audio.mp3');
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          alert('Error playing audio. Make sure the audio file exists.');
        });
        
      } catch (error) {
        console.error('Error generating audio:', error);
        alert('Error generating audio');
      } finally {
        setIsGeneratingAudio(false);
      }
    } else {
      alert('Audio generation is only available for Kan Vibe comics');
    }
  };

  const zoomedPanel = panels.find(panel => panel.isZoomed);

  return (
    <div className="min-h-screen animated-gradient">
      {!zoomedPanel ? (
        // Comic Canvas View
        <div className="h-screen flex flex-col p-4">
          <div className="flex-shrink-0 p-4 flex justify-between items-center">
            <Link href="/">
              <button className="group rounded-lg border border-solid border-amber-100/30 transition-all duration-300 flex items-center justify-center gap-2 bg-stone-800/40 backdrop-blur-sm text-amber-50 hover:bg-stone-700/50 hover:border-amber-100/50 font-medium text-sm h-10 px-6 shadow-xl hover:shadow-2xl hover:scale-105">
                <svg 
                  className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                Back
              </button>
            </Link>
            <h1 className="text-sm text-amber-50/80 drop-shadow-lg font-medium">
              Click any panel to draw
            </h1>
            {/* Save Comic Button - Top Right */}
            <div className="flex items-center gap-2">
              <button
                onClick={clearAllPanels}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Clear All
              </button>
              <input
                type="text"
                value={comicTitle}
                onChange={(e) => setComicTitle(e.target.value)}
                placeholder="Comic title..."
                className="px-4 py-2 text-sm border border-amber-100/30 rounded-lg bg-stone-800/40 backdrop-blur-sm text-amber-50 placeholder-amber-50/60 focus:outline-none focus:ring-2 focus:ring-amber-200/50 focus:border-amber-100/50 shadow-lg"
              />
              <button
                onClick={generateAudio}
                disabled={isGeneratingAudio || !comicTitle.trim()}
                className="group rounded-lg border border-solid border-purple-200/30 transition-all duration-300 flex items-center justify-center gap-2 bg-purple-600/80 backdrop-blur-sm text-white hover:bg-purple-500/90 hover:border-purple-200/50 font-medium text-sm h-10 px-6 shadow-xl hover:shadow-2xl hover:scale-105 disabled:bg-stone-500/50 disabled:hover:scale-100 disabled:hover:shadow-xl"
              >
                {isGeneratingAudio ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    Generate Audio
                  </>
                )}
              </button>
              <button
                onClick={saveComic}
                disabled={!comicTitle.trim()}
                className="group rounded-lg border border-solid border-amber-200/30 transition-all duration-300 flex items-center justify-center gap-2 bg-amber-600/80 backdrop-blur-sm text-white hover:bg-amber-500/90 hover:border-amber-200/50 font-medium text-sm h-10 px-6 shadow-xl hover:shadow-2xl hover:scale-105 disabled:bg-stone-500/50 disabled:hover:scale-100 disabled:hover:shadow-xl"
              >
                {isEditing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-6">
            <div className="w-full grid grid-cols-3 gap-6" style={{ height: '320px' }}>
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  className="group relative bg-stone-800/60 backdrop-blur-sm rounded-lg cursor-pointer hover:bg-stone-700/60 transition-all duration-300 shadow-2xl hover:shadow-amber-200/20 hover:scale-[1.02] transform-gpu"
                  onClick={() => handlePanelClick(panel.id)}
                >
                  <canvas
                    ref={panel.canvasRef}
                    width={400}
                    height={300}
                    className="w-full h-full rounded-lg pointer-events-none bg-white"
                  />
                  {/* Panel Number Overlay */}
                  <div className="absolute top-2 left-2 w-6 h-6 bg-amber-500/80 backdrop-blur-sm rounded-full flex items-center justify-center text-xs font-bold text-stone-900 shadow-lg group-hover:bg-amber-400/90 transition-colors duration-300">
                    {panel.id}
                  </div>
                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-200/10 to-amber-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Zoomed Panel View with Drawing Toolbar
        <div className="h-screen flex flex-col p-4">
          <div className="flex-shrink-0 p-6 flex justify-between items-center">
            <button
              onClick={() => handlePanelClick(zoomedPanel.id)}
              className="group rounded-lg border border-solid border-amber-100/30 transition-all duration-300 flex items-center justify-center gap-2 bg-stone-800/40 backdrop-blur-sm text-amber-50 hover:bg-stone-700/50 hover:border-amber-100/50 font-medium text-sm h-10 px-6 shadow-xl hover:shadow-2xl hover:scale-105"
            >
              <svg 
                className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              Back to Canvas
            </button>
            <h2 className="text-xl font-bold text-amber-50 drop-shadow-lg flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/80 backdrop-blur-sm rounded-full flex items-center justify-center text-sm font-bold text-stone-900 shadow-lg">
                {zoomedPanel.id}
              </div>
              Panel {zoomedPanel.id}
            </h2>
          </div>
          
          <div className="flex-1 flex overflow-hidden">
            {/* Canvas Area */}
            <div className="flex-1 flex items-center justify-center p-4 min-w-0">
              <canvas
                ref={zoomedPanel.canvasRef}
                width={800}
                height={600}
                className="rounded-xl bg-white shadow-2xl shadow-amber-500/10 max-w-full max-h-full"
                onMouseDown={(e) => handleMouseDown(e, zoomedPanel.id)}
                onMouseMove={(e) => handleMouseMove(e, zoomedPanel.id)}
                onMouseUp={() => handleMouseUp(zoomedPanel.id)}
                onMouseLeave={() => handleMouseUp(zoomedPanel.id)}
              />
            </div>
            
            {/* Combined Tools and Generate Section - Right Side */}
            <div className="w-80 bg-stone-800/40 backdrop-blur-sm rounded-l-xl p-4 flex flex-col overflow-y-auto border border-amber-100/20">
              {/* Generate Scene Section */}
              <div className="mb-6">
                <h3 className="text-base font-bold text-amber-50 drop-shadow-lg mb-3">
                  Generate Scene
                </h3>
                <div className="flex flex-col gap-3">
                  <textarea
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    placeholder="Describe the scene you want to generate..."
                    className="w-full px-3 py-2 border border-amber-100/30 rounded-lg bg-stone-800/40 backdrop-blur-sm text-amber-50 placeholder-amber-50/60 focus:outline-none focus:ring-2 focus:ring-amber-200/50 focus:border-amber-100/50 resize-none shadow-lg text-sm"
                    rows={3}
                  />
                  <button
                    onClick={() => generateComicArt(zoomedPanel.id)}
                    disabled={isGenerating || !textPrompt.trim()}
                    className="group w-full rounded-lg border border-solid border-amber-200/30 transition-all duration-300 flex items-center justify-center gap-2 bg-amber-600/80 backdrop-blur-sm text-white hover:bg-amber-500/90 hover:border-amber-200/50 font-medium text-sm h-10 px-4 shadow-xl hover:shadow-2xl hover:scale-105 disabled:bg-stone-500/50 disabled:hover:scale-100 disabled:hover:shadow-xl"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate Scene
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-base font-bold text-amber-50 drop-shadow-lg mb-3">
                  Drawing Tools
                </h3>
                
                <div className="mb-4">
                  <label className="text-xs font-medium text-amber-50/80 mb-2 block">Tools</label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleToolChange('pen')}
                      className={`flex-1 px-3 py-2 rounded-lg transition-all duration-300 font-medium text-sm ${
                        currentTool === 'pen' 
                          ? 'bg-amber-500/80 text-stone-900 shadow-lg border border-amber-300/50' 
                          : 'bg-stone-800/40 text-amber-50 border border-amber-100/20 hover:bg-stone-700/50 hover:border-amber-100/40'
                      }`}
                    >
                      <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Pen
                    </button>
                    <button
                      onClick={() => handleToolChange('eraser')}
                      className={`flex-1 px-3 py-2 rounded-lg transition-all duration-300 font-medium text-sm ${
                        currentTool === 'eraser' 
                          ? 'bg-amber-500/80 text-stone-900 shadow-lg border border-amber-300/50' 
                          : 'bg-stone-800/40 text-amber-50 border border-amber-100/20 hover:bg-stone-700/50 hover:border-amber-100/40'
                      }`}
                    >
                      <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eraser
                    </button>
                  </div>
                </div>
                
                {/* Brush Size */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-amber-50/80 mb-2 block">Brush Size</label>
                  <div className="flex items-center space-x-2 bg-stone-800/40 rounded-lg px-3 py-2 border border-amber-100/20">
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="flex-1 accent-amber-500"
                    />
                    <span className="text-xs font-bold text-amber-50 w-6 text-center">{brushSize}</span>
                  </div>
                </div>
                
                {/* Color Picker */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-amber-50/80 mb-2 block">Color</label>
                  <div className="flex items-center space-x-2 bg-stone-800/40 rounded-lg px-3 py-2 border border-amber-100/20">
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => setCurrentColor(e.target.value)}
                      className="w-8 h-8 rounded border border-amber-100/30 bg-stone-800/60 cursor-pointer"
                    />
                    <span className="text-xs text-amber-50/80">Current color</span>
                  </div>
                </div>

                {/* Clear Panel Button */}
                <div>
                  <button
                    onClick={() => clearPanel(zoomedPanel.id)}
                    className="group w-full rounded-lg border border-solid border-amber-200/30 transition-all duration-300 flex items-center justify-center gap-2 bg-stone-700/80 backdrop-blur-sm text-amber-50 hover:bg-stone-600/90 hover:border-amber-200/50 font-medium text-sm h-10 px-4 shadow-xl hover:shadow-2xl hover:scale-105"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear Panel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
