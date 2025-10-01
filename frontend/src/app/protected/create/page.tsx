'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { buildApiUrl, API_CONFIG } from '../../../config/api';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

// Create Supabase client (shared with AuthProvider)
const supabase = createSupabaseClient()


interface Panel {
  id: number;
  isZoomed: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  smallCanvasData: string | null; // base64 data URL for small canvas
  largeCanvasData: string | null; // base64 data URL for large canvas
  prompt?: string; // Optional prompt for the panel
  isEnabled: boolean; // Whether the panel is unlocked for editing
}

export default function CreatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [panels, setPanels] = useState<Panel[]>([
    { id: 1, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null, prompt: undefined, isEnabled: true },
    { id: 2, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null, prompt: undefined, isEnabled: false },
    { id: 3, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null, prompt: undefined, isEnabled: false },
    { id: 4, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null, prompt: undefined, isEnabled: false },
    { id: 5, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null, prompt: undefined, isEnabled: false },
    { id: 6, isZoomed: false, canvasRef: useRef<HTMLCanvasElement>(null), smallCanvasData: null, largeCanvasData: null, prompt: undefined, isEnabled: false },
  ]);

  // Function to get the session token for API requests
    const getAccessToken = async () => {
      // 1) Try to read current session
      let { data: { session }, error } = await supabase.auth.getSession();
      console.log('🔍 DEBUG:getSession -> session:', session, 'error:', error);

      // 2) If missing, try to refresh using stored refresh token
      if (!session) {
        console.log('ℹ️ No session returned. Attempting refreshSession...');
        const refreshRes = await supabase.auth.refreshSession();
        console.log('🔍 DEBUG:refreshSession ->', refreshRes);
        session = refreshRes.data.session ?? null;
      }

      // 3) As a fallback, validate via getUser (forces a user check)
      if (!session) {
        console.log('ℹ️ No session after refresh. Attempting getUser as fallback...');
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        console.log('🔍 DEBUG:getUser -> user:', userData?.user, 'error:', userErr);
        if (userData?.user) {
          // Try getting session once more
          const s2 = await supabase.auth.getSession();
          session = s2.data.session ?? null;
          console.log('🔍 DEBUG:getSession (after getUser) ->', session);
        }
      }
      if (!session) {
        console.log('❌ No active session available after retries');
        throw new Error('No active session. Please sign in first.');
      }
      if (!session.access_token) {
        console.log('❌ Session present but missing access_token');
        throw new Error('No access token available');
      }
      console.log('🔍 DEBUG: Access token length:', session.access_token.length);
      console.log('🔍 DEBUG: Access token starts with:', session.access_token.substring(0, 50));
      // Check if token has proper JWT structure (3 parts separated by dots)
      const tokenParts = session.access_token.split('.');
      console.log('🔍 DEBUG: Token parts count:', tokenParts.length);
      if (tokenParts.length !== 3) {
        console.log('❌ Invalid JWT format - expected 3 parts, got:', tokenParts.length);
        throw new Error('Invalid JWT token format');
      }

      return session.access_token;
    };

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [brushSize, setBrushSize] = useState(3);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [textPrompt, setTextPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [comicTitle, setComicTitle] = useState('Untitled');
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    };
  }, [currentAudio]);

  useEffect(() => {
    const loadComicFromURL = async () => {
      // Check for comic parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const comicTitle = urlParams.get('comic');
      
      if (comicTitle) {
        try {
          console.log(`Loading comic from URL parameter: ${comicTitle}`);
          
          const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.LOAD_COMIC}/${comicTitle}`));
          if (response.ok) {
            const comic = await response.json();
            const formattedTitle = comic.comic_title
              .replace(/_/g, ' ')
              .split(' ')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
            setComicTitle(formattedTitle);
            setIsEditing(true);
            
            if (comic.panels) {
              // Find the highest panel number with content
              const highestPanelWithContent = Math.max(
                ...comic.panels
                  .filter((p: any) => p.image_data)
                  .map((p: any) => p.id)
              );

              const updatedPanels = panels.map(panel => {
                const savedPanel = comic.panels.find((p: any) => p.id === panel.id);
                if (savedPanel && savedPanel.image_data) {
                  return {
                    ...panel,
                    smallCanvasData: savedPanel.image_data,
                    largeCanvasData: savedPanel.image_data,
                    prompt: savedPanel.prompt || `Panel ${panel.id}`,
                    isEnabled: true // Enable panels with content
                  };
                }
                // Enable all panels up to and including the one after the last filled panel
                return {
                  ...panel,
                  isEnabled: panel.id <= highestPanelWithContent + 1
                };
              });

              setPanels(updatedPanels);
              
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

    console.log(`💾 Saving ${isLargeCanvas ? 'LARGE' : 'small'} canvas data for panel ${panelId}`);
    console.log(`   - Data URL length: ${dataURL.length}`);
    console.log(`   - Data preview: ${dataURL.substring(0, 50)}...`);

    setPanels(prev => prev.map(p =>
      p.id === panelId
        ? {
            ...p,
            [isLargeCanvas ? 'largeCanvasData' : 'smallCanvasData']: dataURL
          }
        : p
    ));

    // Enable the next panel if this panel now has content
    if (dataURL && dataURL.length > 100) {
      enableNextPanel(panelId);
    }

    console.log(`✅ Canvas state saved for panel ${panelId} (${isLargeCanvas ? 'LARGE' : 'small'})`);
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

  // Enable next panel when current panel has content
  const enableNextPanel = (currentPanelId: number) => {
    setPanels(prev => prev.map(p => {
      // Enable the next panel if current panel has content
      if (p.id === currentPanelId + 1) {
        return { ...p, isEnabled: true };
      }
      return p;
    }));
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

    setPanels(prev => prev.map(p => ({
      ...p,
      isZoomed: p.id === panelId ? !p.isZoomed : false
    })));

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

    // Update panel data to reflect cleared state and disable subsequent panels
    setPanels(prev => prev.map(p => {
      if (p.id === panelId) {
        return { ...p, smallCanvasData: null, largeCanvasData: null, prompt: undefined };
      }
      // Disable all panels after the cleared one
      if (p.id > panelId) {
        return { ...p, isEnabled: false };
      }
      return p;
    }));

    // Panel cleared - frontend state is automatically updated
  };

  const goToNextPanel = (currentPanelId: number) => {
    // Save current panel's state before navigating
    saveCanvasState(currentPanelId, true);
    updateSmallCanvasPreview(currentPanelId);

    // Navigate to next panel (or stay on panel 6 if it's the last)
    const nextPanelId = currentPanelId < 6 ? currentPanelId + 1 : currentPanelId;

    // Check if next panel is enabled
    const nextPanel = panels.find(p => p.id === nextPanelId);
    if (nextPanel && nextPanel.isEnabled) {
      // Zoom out current panel and zoom into next panel
      setPanels(prev => prev.map(p => ({
        ...p,
        isZoomed: p.id === nextPanelId
      })));

      // Restore canvas state for the next panel after a short delay
      setTimeout(() => {
        restoreCanvasState(nextPanelId, true);
      }, 100);
    }
  };

  // No need to reset backend context - frontend manages all continuity state

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
      largeCanvasData: null,
      prompt: undefined
    })));
    
    // All panels cleared - frontend state is automatically updated
  };

  const createComic = async () => {
    console.log('🔍 DEBUG: Proceeding to confirmation page');

    // Check if any panels have content
    const panelsWithData = panels.filter(panel => panel.largeCanvasData);
    if (panelsWithData.length === 0) {
      alert('Please create at least one panel before proceeding.');
      return;
    }

    try {
      // Store panels data in sessionStorage for the confirmation page
      const panelsData = panels
        .filter(panel => !!panel.largeCanvasData)
        .map(panel => ({ 
          id: panel.id, 
          prompt: panel.prompt || `Panel ${panel.id}`,
          image_data: panel.largeCanvasData,
          is_zoomed: false
        }));

      sessionStorage.setItem('comicPanelsData', JSON.stringify(panelsData));

      console.log('✅ Comic data stored in sessionStorage, navigating to confirmation');
      router.push('/protected/confirm');
      
    } catch (error) {
      console.error('❌ Error preparing comic data:', error);
      alert(`Failed to prepare comic data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const savePanelsAsPNG = async (title: string) => {
    // Ensure we have a valid title
    if (!title || title.trim() === '') {
      throw new Error('Comic title cannot be empty. Please enter a title before saving.');
    }
    
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    console.log(`🔍 DEBUG: Original title: "${title}", Safe title: "${safeTitle}"`);
    
    // Ensure safeTitle is not empty after processing
    if (!safeTitle || safeTitle.trim() === '') {
      throw new Error('Comic title becomes invalid after processing. Please use a title with letters or numbers.');
    }
    
    // Check if any panels have data
    const panelsWithData = panels.filter(panel => panel.largeCanvasData);
    console.log(`🔍 DEBUG: Found ${panelsWithData.length} panels with data out of ${panels.length} total panels`);
    
    if (panelsWithData.length === 0) {
      throw new Error('No panels have been drawn yet. Please draw something before saving.');
    }
    
    try {
      // Send each panel to backend to save in project directory
      // Panel data is managed in React state and will be saved via save-comic endpoint
      // No need to save individual panels to backend storage
      console.log(`✅ All panel data is ready in React state for comic creation`);
    } catch (error) {
      console.error('Error saving PNG files:', error);
      throw new Error(`Failed to save PNG files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

      // Get access token for API request
      const accessToken = await getAccessToken();
      
      // Get previous panel for continuity (if exists)
      const previousPanel = panelId > 1 ? panels.find(p => p.id === panelId - 1) : null;
      console.log(`🔍 Previous panel (${panelId - 1}):`, {
        exists: !!previousPanel,
        hasLargeCanvasData: !!previousPanel?.largeCanvasData,
        hasPrompt: !!previousPanel?.prompt,
        largeCanvasDataLength: previousPanel?.largeCanvasData?.length
      });

      const previousPanelContext = previousPanel && previousPanel.largeCanvasData && previousPanel.prompt ? {
        prompt: previousPanel.prompt,
        image_data: previousPanel.largeCanvasData.split(',')[1] // Remove data:image/png;base64, prefix
      } : null;

      // Call backend API
      console.log(`🚀 Generating comic art for panel ${panelId} with prompt: ${textPrompt.substring(0, 50)}...`);
      if (previousPanelContext) {
        console.log(`🎯 Using previous panel context from panel ${panelId - 1}`);
        console.log(`   - Previous prompt: ${previousPanelContext.prompt}`);
        console.log(`   - Context image size: ${previousPanelContext.image_data.length} bytes`);
      } else {
        console.log(`⚠️ No previous panel context available for panel ${panelId}`);
      }
      
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

            // Save the prompt for this panel (important for context in next panels)
            setPanels(prev => prev.map(p =>
              p.id === panelId ? { ...p, prompt: textPrompt } : p
            ));
            console.log(`💾 Saved prompt for panel ${panelId}: "${textPrompt}"`);
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
        
        // Stop any currently playing audio
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
        
        // Create audio element and play the kanban_audio.mp3
        const audio = new Audio('/saved-comics/kan_vibe/kanban_audio.mp3');
        setCurrentAudio(audio);
        
        // Set up event listeners
        audio.addEventListener('play', () => setIsAudioPlaying(true));
        audio.addEventListener('pause', () => setIsAudioPlaying(false));
        audio.addEventListener('ended', () => setIsAudioPlaying(false));
        
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          alert('Error playing audio. Make sure the audio file exists.');
          setIsAudioPlaying(false);
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

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsAudioPlaying(false);
    }
  };

  const zoomedPanel = panels.find(panel => panel.isZoomed);

  return (
    <div className="h-full">
      {!zoomedPanel ? (
        // Comic Canvas View
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 p-4 flex justify-end items-center">
            {/* Action Buttons - Right Side */}
            <div className="flex items-center gap-2">
              <button
                onClick={createComic}
                className="group rounded-lg border border-solid border-accent/30 transition-all duration-300 flex items-center justify-center gap-2 bg-accent backdrop-blur-sm text-foreground-inverse hover:bg-accent-hover hover:border-accent/50 font-medium text-sm h-10 px-6 shadow-xl hover:shadow-2xl hover:scale-105"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {isEditing ? 'Update Comic' : 'Continue to Publish'}
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-6 overflow-hidden">
            <div className="w-full h-full grid grid-cols-3 gap-6">
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  data-panel-id={panel.id}
                  className={`group relative bg-background-card backdrop-blur-sm transition-all duration-300 transform-gpu border-4 ${
                    panel.isEnabled
                      ? 'cursor-pointer hover:bg-background-tertiary hover:scale-[1.02] border-black'
                      : 'cursor-not-allowed opacity-40 border-gray-400'
                  }`}
                  onClick={() => handlePanelClick(panel.id)}
                >
                  <canvas
                    ref={panel.canvasRef}
                    width={400}
                    height={300}
                    className="w-full h-full pointer-events-none bg-white"
                  />
                  {/* Panel Number Overlay */}
                  <div className="absolute top-2 left-2 w-6 h-6 bg-accent backdrop-blur-sm flex items-center justify-center text-xs font-bold text-foreground-inverse group-hover:bg-accent-light transition-colors duration-300 border-2 border-black">
                    {panel.id}
                  </div>

                  {/* Simple overlay for disabled panels */}
                  {!panel.isEnabled && (
                    <div className="absolute inset-0 bg-white/60 pointer-events-none" />
                  )}

                  {/* Trash Icon Overlay */}
                  {panel.isEnabled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearPanel(panel.id);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-600/90 transition-colors duration-300 opacity-0 group-hover:opacity-100 border-2 border-black"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  {/* Hover Effect Overlay */}
                  {panel.isEnabled && (
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-accent-light/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Zoomed Panel View with Drawing Toolbar
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 p-6 flex justify-between items-center">
            <button
              onClick={() => handlePanelClick(zoomedPanel.id)}
              className="group rounded-lg border border-solid border-border transition-all duration-300 flex items-center justify-center gap-2 bg-background-secondary backdrop-blur-sm text-foreground hover:bg-background-tertiary hover:border-border-secondary font-medium text-sm h-10 px-6 shadow-xl hover:shadow-2xl hover:scale-105"
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
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Canvas Area */}
            <div className="flex-1 flex items-center justify-center p-4 min-w-0 min-h-0">
              <canvas
                ref={zoomedPanel.canvasRef}
                width={800}
                height={600}
                className="bg-background-card max-w-full max-h-full w-auto h-auto border-4 border-black"
                onMouseDown={(e) => handleMouseDown(e, zoomedPanel.id)}
                onMouseMove={(e) => handleMouseMove(e, zoomedPanel.id)}
                onMouseUp={() => handleMouseUp(zoomedPanel.id)}
                onMouseLeave={() => handleMouseUp(zoomedPanel.id)}
              />
            </div>

            {/* Combined Tools and Generate Section - Bottom */}
            <div className="bg-background-secondary p-4 flex flex-col gap-4 items-center">
              {/* Figma-style Toolbar */}
              <div className="bg-background-card rounded-xl px-3 py-2 flex items-center gap-1 shadow-lg border-2 border-border">
                <button
                  onClick={() => handleToolChange('pen')}
                  className={`p-2.5 rounded-lg transition-all ${
                    currentTool === 'pen'
                      ? 'bg-accent text-foreground-inverse'
                      : 'text-foreground hover:bg-background-tertiary'
                  }`}
                  title="Pen"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleToolChange('eraser')}
                  className={`p-2.5 rounded-lg transition-all ${
                    currentTool === 'eraser'
                      ? 'bg-accent text-foreground-inverse'
                      : 'text-foreground hover:bg-background-tertiary'
                  }`}
                  title="Eraser"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-6.36-6.36-3.54 3.53c-.78.79-.78 2.05 0 2.83z"/>
                  </svg>
                </button>

                <div className="w-px h-6 bg-border mx-1"></div>

                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => setCurrentColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-2 border-border"
                  title="Color"
                />

                <div className="w-px h-6 bg-border mx-1"></div>

                <button
                  onClick={() => clearPanel(zoomedPanel.id)}
                  className="p-2.5 rounded-lg text-foreground hover:bg-background-tertiary transition-all"
                  title="Clear"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Generate Scene Section */}
              <div className="w-full max-w-2xl flex items-center gap-3 bg-background-card rounded-lg border-2 border-border p-3">
                <textarea
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="Describe the scene..."
                  className="flex-1 bg-transparent text-foreground placeholder-foreground-muted focus:outline-none resize-none text-sm leading-relaxed min-h-[60px]"
                  rows={3}
                />
                <button
                  onClick={() => generateComicArt(zoomedPanel.id)}
                  disabled={isGenerating || !textPrompt.trim()}
                  className="flex p-2.5 rounded-lg bg-accent text-foreground-inverse hover:bg-accent-hover transition-all disabled:bg-background-muted disabled:cursor-not-allowed flex items-center justify-center"
                  title="Generate"
                >
                  {isGenerating ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 00-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05a.996.996 0 000-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
