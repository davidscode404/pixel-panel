'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

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
          const response = await fetch(`http://localhost:3004/load-comic/${comicTitle}`);
          if (response.ok) {
            const comic = await response.json();
            setComicTitle(comic.comic_title);
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
          alert(`Failed to load comic: ${error.message}`);
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
      console.error('Error details:', error.message);
      alert(`Failed to save comic: ${error.message}`);
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
          const response = await fetch('http://localhost:3004/save-panel', {
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
      throw new Error(`Failed to save PNG files: ${error.message}`);
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
      const response = await fetch('http://localhost:3004/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text_prompt: textPrompt,
          reference_image: base64Data
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

  const zoomedPanel = panels.find(panel => panel.isZoomed);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {!zoomedPanel ? (
        // Comic Canvas View
        <div className="h-screen flex flex-col">
          <div className="flex-shrink-0 p-2 flex justify-between items-center">
            <Link href="/">
              <button className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors">
                ← Back to Home
              </button>
            </Link>
            <h1 className="text-xs text-gray-500 dark:text-gray-500">
              Click any panel to draw
            </h1>
            {/* Save Comic Button - Top Right */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={comicTitle}
                onChange={(e) => setComicTitle(e.target.value)}
                placeholder="Comic title..."
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={saveComic}
                disabled={!comicTitle.trim()}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                {isEditing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-2">
            <div className="w-full grid grid-cols-3 gap-2" style={{ height: '300px' }}>
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  className="relative bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors duration-200 shadow-lg"
                  onClick={() => handlePanelClick(panel.id)}
                >
                  <canvas
                    ref={panel.canvasRef}
                    width={400}
                    height={300}
                    className="w-full h-full rounded-lg pointer-events-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Zoomed Panel View with Drawing Toolbar
        <div className="h-screen flex flex-col">
          <div className="flex-shrink-0 p-4 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-800 dark:text-white">
              Panel {zoomedPanel.id}
            </h2>
            <button
              onClick={() => handlePanelClick(zoomedPanel.id)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Canvas
            </button>
          </div>
          
          <div className="flex-1 flex">
            {/* Canvas Area */}
            <div className="flex-1 flex items-center justify-center p-4">
              <canvas
                ref={zoomedPanel.canvasRef}
                width={800}
                height={600}
                className="border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-2xl"
                onMouseDown={(e) => handleMouseDown(e, zoomedPanel.id)}
                onMouseMove={(e) => handleMouseMove(e, zoomedPanel.id)}
                onMouseUp={() => handleMouseUp(zoomedPanel.id)}
                onMouseLeave={() => handleMouseUp(zoomedPanel.id)}
              />
            </div>
            
            {/* Text Input and Generate Button - Right Side */}
            <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-300 dark:border-gray-600 p-4 flex flex-col">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">
                Generate Scene
              </h3>
              <div className="flex flex-col gap-4">
                <textarea
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="Describe the scene you want to generate..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={4}
                />
                <button
                  onClick={() => generateComicArt(zoomedPanel.id)}
                  disabled={isGenerating || !textPrompt.trim()}
                  className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                >
                  {isGenerating ? 'Generating...' : 'Generate Scene'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Drawing Toolbar */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600 p-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Tool Selection */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleToolChange('pen')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentTool === 'pen' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Pen
                  </button>
                  <button
                    onClick={() => handleToolChange('eraser')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentTool === 'eraser' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Eraser
                  </button>
                </div>
                
                {/* Brush Size */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">Size:</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-6">{brushSize}</span>
                </div>
                
                {/* Color Picker */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">Color:</label>
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => setCurrentColor(e.target.value)}
                    className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => clearPanel(zoomedPanel.id)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Clear Panel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
