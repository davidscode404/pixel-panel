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
            <div className="w-20"></div> {/* Spacer for centering */}
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
