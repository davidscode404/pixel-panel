'use client';

import { useState, useRef, useEffect } from 'react';

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

  const zoomedPanel = panels.find(panel => panel.isZoomed);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {!zoomedPanel ? (
        // Comic Canvas View
        <div className="h-screen flex flex-col">
          <div className="flex-shrink-0 p-1">
            <h1 className="text-xs text-center text-gray-500 dark:text-gray-500">
              Click any panel to draw
            </h1>
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
