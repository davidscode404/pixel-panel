'use client';

import { useState, useEffect, createRef } from 'react';
import { useRouter } from 'next/navigation';
import { buildApiUrl, API_CONFIG } from '../../../config/api';
import AlertBanner from '@/components/ui/AlertBanner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ActionBar from '@/components/create/ActionBar';
import PanelGrid from '@/components/create/PanelGrid';
import DrawingToolbar from '@/components/create/DrawingToolbar';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { ComicPanel } from '@/types';

const supabase = createSupabaseClient()

interface Panel extends Omit<ComicPanel, 'id' | 'panel_number' | 'public_url'> {
  id: number;
  isZoomed: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  smallCanvasData: string | null;
  largeCanvasData: string | null;
  prompt?: string;
  isEnabled: boolean;
}

export default function CreatePage() {
  const router = useRouter();

  // Helper function to create a panel
  const createPanel = (id: number, isEnabled: boolean = false): Panel => ({
    id,
    isZoomed: false,
    canvasRef: createRef<HTMLCanvasElement>(),
    smallCanvasData: null,
    largeCanvasData: null,
    prompt: undefined,
    isEnabled
  });

  const [panels, setPanels] = useState<Panel[]>([
    createPanel(1, true),
    createPanel(2),
    createPanel(3),
    createPanel(4),
    createPanel(5),
    createPanel(6),
  ]);

    const getAccessToken = async () => {
      let { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        const refreshRes = await supabase.auth.refreshSession();
        session = refreshRes.data.session ?? null;
      }

      if (!session) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const s2 = await supabase.auth.getSession();
          session = s2.data.session ?? null;
        }
      }

      if (!session) {
        throw new Error('No active session. Please sign in first.');
      }

      if (!session.access_token) {
        throw new Error('No access token available');
      }

      const tokenParts = session.access_token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid JWT token format');
      }

      return session.access_token;
    };

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [brushSize] = useState(3);
  const [currentColor, setCurrentColor] = useState('#000000');
  
  // Generation state
  const [textPrompt, setTextPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  
  
  // Audio state
  const [currentAudio] = useState<HTMLAudioElement | null>(null);

  // Helper function to update panels
  const updatePanel = (panelId: number, updates: Partial<Panel>) => {
    setPanels(prev => prev.map(p => 
      p.id === panelId ? { ...p, ...updates } : p
    ));
  };

  // Helper function to update multiple panels
  const updatePanels = (updates: (panel: Panel) => Partial<Panel> | null) => {
    setPanels(prev => prev.map(p => {
      const panelUpdates = updates(p);
      return panelUpdates ? { ...p, ...panelUpdates } : p;
    }));
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    };
  }, [currentAudio]);



  const saveCanvasState = (panelId: number, isLargeCanvas: boolean = false) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    const canvas = panel.canvasRef.current;
    const dataURL = canvas.toDataURL();

    updatePanel(panelId, {
            [isLargeCanvas ? 'largeCanvasData' : 'smallCanvasData']: dataURL
    });

    if (dataURL && dataURL.length > 100) {
      enableNextPanel(panelId);
    }
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

  const enableNextPanel = (currentPanelId: number) => {
    updatePanel(currentPanelId + 1, { isEnabled: true });
  };


  const handlePanelClick = (panelId: number) => {
    const panel = panels.find(p => p.id === panelId);

    // Don't allow clicking disabled panels
    if (!panel?.isEnabled) {
      return;
    }

    if (panel?.isZoomed) {
      saveCanvasState(panelId, true);
      updateSmallCanvasPreview(panelId);
    }

    updatePanels(p => ({
      isZoomed: p.id === panelId ? !p.isZoomed : false
    }));

    if (!panel?.isZoomed) {
      setTimeout(() => {
        restoreCanvasState(panelId, true);
      }, 100);
    } else {
      setTimeout(() => {
        forceRestoreSmallCanvases();
      }, 100);
    }
  };

  // Restore small canvas data when returning to grid view
  useEffect(() => {
    const zoomedPanel = panels.find(p => p.isZoomed);
    if (!zoomedPanel) {
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
    
    // Scale coordinates from display size to canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 8; // Make eraser much bigger
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
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleMouseUp = (panelId: number) => {
    setIsDrawing(false);
    const zoomedPanel = panels.find(panel => panel.isZoomed);
    if (zoomedPanel && zoomedPanel.id === panelId) {
      saveCanvasState(panelId, true);
      updateSmallCanvasPreview(panelId);
    } else {
      saveCanvasState(panelId, false);
    }
  };

  const updateSmallCanvasPreview = (panelId: number) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    const canvas = panel.canvasRef.current;
    const dataURL = canvas.toDataURL();
    
    // Update the small canvas preview
    updatePanel(panelId, { smallCanvasData: dataURL });
  };

  // Force restore small canvas data when returning to grid view
  const forceRestoreSmallCanvases = () => {
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
  };

  const handleToolChange = (tool: string) => {
    setCurrentTool(tool);
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

    // Update panel data to reflect cleared state and disable subsequent panels
    updatePanels(p => {
      if (p.id === panelId) {
        return { smallCanvasData: null, largeCanvasData: null, prompt: undefined };
      }
      // Disable all panels after the cleared one
      if (p.id > panelId) {
        return { isEnabled: false };
      }
      return null;
    });

  };

  const createComic = async () => {
    const panelsWithData = panels.filter(panel => panel.largeCanvasData);
    if (panelsWithData.length === 0) {
      setError('Please create at least one panel before proceeding.');
      return;
    }

    const panelsDataForSave = panels
      .filter(panel => !!panel.largeCanvasData)
      .map(panel => ({ id: panel.id, largeCanvasData: panel.largeCanvasData }));

    if (panelsDataForSave.length === 0) {
      setError('No panels have been drawn yet. Please draw something before saving.');
      return;
    }

    setShowPublishConfirm(true);
  };

  // Helper function to compress canvas data
  const compressCanvasData = (canvasData: string, quality: number = 0.8): Promise<string> => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(canvasData);
          return;
        }
        
        // Set canvas size to a reasonable resolution for storage
        const maxWidth = 800;
        const maxHeight = 600;
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to compressed JPEG
        const compressedData = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedData);
      };
      img.src = canvasData;
    });
  };

  const handleConfirmPublish = async () => {
    try {
      // Compress all panel images before storing
      const compressedPanels = await Promise.all(
        panels
          .filter(panel => !!panel.largeCanvasData)
          .map(async (panel) => {
            const compressedImage = await compressCanvasData(panel.largeCanvasData!);
            return { 
              id: panel.id, 
              prompt: panel.prompt || `Panel ${panel.id}`,
              image_data: compressedImage,
              is_zoomed: false
            };
          })
      );

      const compressedData = JSON.stringify(compressedPanels);
      
      // Check if data is still too large for sessionStorage
      if (compressedData.length > 4 * 1024 * 1024) { // 4MB threshold
        setError('Comic data is too large to save. Please reduce the number of panels or try again.');
        return;
      }

      sessionStorage.setItem('comicPanelsData', compressedData);
      // Show a warning banner on the confirm page that panels cannot be edited there
      sessionStorage.setItem('showPanelEditWarning', '1');

      router.push('/app/confirm');
      
    } catch (error) {
      setError(`Failed to prepare comic data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setShowPublishConfirm(false);
    }
  };

  const handleCancelPublish = () => {
    setShowPublishConfirm(false);
  };

  const generateComicArt = async (panelId: number) => {
    if (!textPrompt.trim()) {
      setError('Please enter a text prompt');
      return;
    }

    const panel = panels.find(p => p.id === panelId);
    if (!panel || !panel.canvasRef.current) return;

    setIsGenerating(true);
    
    try {
      const canvas = panel.canvasRef.current;
      const canvasData = canvas.toDataURL('image/png');
      const base64Data = canvasData.split(',')[1];

      const accessToken = await getAccessToken();
      
      const previousPanel = panelId > 1 ? panels.find(p => p.id === panelId - 1) : null;

      const previousPanelContext = previousPanel && previousPanel.largeCanvasData && previousPanel.prompt ? {
        prompt: previousPanel.prompt,
        image_data: previousPanel.largeCanvasData.split(',')[1] 
      } : null;

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.GENERATE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          text_prompt: textPrompt,
          reference_image: base64Data,
          panel_id: panelId,
          previous_panel_context: previousPanelContext
        })
      });

      const result = await response.json();

      if (result.success) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const canvasAspect = canvas.width / canvas.height;
            const imgAspect = img.width / img.height;
            
            let drawWidth, drawHeight, offsetX, offsetY;
            
            if (imgAspect > canvasAspect) {
              drawWidth = canvas.width;
              drawHeight = canvas.width / imgAspect;
              offsetX = 0;
              offsetY = (canvas.height - drawHeight) / 2;
            } else {
              drawHeight = canvas.height;
              drawWidth = canvas.height * imgAspect;
              offsetX = (canvas.width - drawWidth) / 2;
              offsetY = 0;
            }
            
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

            saveCanvasState(panelId, true);
            updateSmallCanvasPreview(panelId);

            updatePanel(panelId, { prompt: textPrompt });
          }
        };
        img.src = `data:image/png;base64,${result.image_data}`;
      } else {
        setError(result.error || 'Error generating comic art');
      }
    } catch {
      setError('Failed to generate comic art. Make sure the backend server is running.');
    } finally {
      setIsGenerating(false);
    }
  };

  const zoomedPanel = panels.find(panel => panel.isZoomed);


  return (
    <div className="h-full">
      {error && (
        <div className="p-4">
          <AlertBanner type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}
      {!zoomedPanel ? (
        <div className="h-full flex flex-col">
          <ActionBar onCreate={createComic} />
          <div className="flex-1 p-6 overflow-hidden">
            <PanelGrid 
              panels={panels}
              onPanelClick={handlePanelClick}
              onClearPanel={clearPanel}
            />
          </div>
        </div>
      ) : (
        // Zoomed Panel View with Drawing Toolbar
        <div className="h-full flex">
          {/* Canvas Area */}
          <div className="flex-1 flex flex-col">
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
              <h2 className="text-xl font-bold text-foreground drop-shadow-lg flex items-center gap-3">
                <div className="w-8 h-8 bg-accent backdrop-blur-sm flex items-center justify-center text-sm font-bold text-foreground-inverse border-2 border-black">
                  {zoomedPanel.id}
                </div>
                Panel {zoomedPanel.id}
              </h2>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-4 min-w-0 min-h-0">
              <canvas
                ref={zoomedPanel.canvasRef}
                width={800}
                height={600}
                className="bg-white border-4 border-black shadow-lg"
                style={{ 
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  aspectRatio: '4/3',
                  display: 'block',
                  cursor: currentTool === 'eraser' ? 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><rect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'white\' stroke=\'black\' stroke-width=\'2\'/></svg>") 12 12, auto' : 'crosshair'
                }}
                onMouseDown={(e) => handleMouseDown(e, zoomedPanel.id)}
                onMouseMove={(e) => handleMouseMove(e, zoomedPanel.id)}
                onMouseUp={() => handleMouseUp(zoomedPanel.id)}
                onMouseLeave={() => handleMouseUp(zoomedPanel.id)}
              />
            </div>
          </div>

          {/* Drawing Tools Panel - Right Side - Full Height */}
          <div className="w-80 flex flex-col h-full p-4">
            <DrawingToolbar
              currentTool={currentTool}
              onToolChange={handleToolChange}
              currentColor={currentColor}
              onColorChange={setCurrentColor}
              onClear={() => clearPanel(zoomedPanel.id)}
              textPrompt={textPrompt}
              setTextPrompt={setTextPrompt}
              onGenerate={() => generateComicArt(zoomedPanel.id)}
              isGenerating={isGenerating}
              panelId={zoomedPanel.id}
            />
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={showPublishConfirm}
        title="Continue to Publish?"
        message="Note: Your comic panels are not editable during publishing. Make sure your panels are complete before proceeding."
        confirmText="Continue to Publish"
        cancelText="Keep Editing"
        onConfirm={handleConfirmPublish}
        onCancel={handleCancelPublish}
      />
    </div>
  );
}
