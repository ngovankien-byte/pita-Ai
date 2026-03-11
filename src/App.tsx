/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Shirt, 
  Play, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useDropzone, type Accept } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type AppMode = 'outfit' | 'action-image' | 'motion';

interface FileWithPreview extends File {
  preview: string;
}

// --- Components ---

const FileUpload = ({ 
  onFileSelect, 
  accept, 
  label, 
  icon: Icon, 
  preview 
}: { 
  onFileSelect: (file: File) => void; 
  accept: Accept; 
  label: string; 
  icon: any;
  preview?: string;
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: false
  } as any);

  return (
    <div 
      {...getRootProps()} 
      className={cn(
        "relative group cursor-pointer border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center p-6 min-h-[200px]",
        isDragActive ? "border-emerald-500 bg-emerald-50/50" : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50",
        preview && "border-none p-0 overflow-hidden"
      )}
    >
      <input {...getInputProps()} />
      {preview ? (
        <div className="relative w-full h-full group">
          {accept['video/*'] ? (
            <video src={preview} className="w-full h-full object-cover" autoPlay muted loop playsInline />
          ) : (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <p className="text-white text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Change {label}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Icon className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400" />
          </div>
          <p className="text-zinc-300 font-medium text-center">{label}</p>
          <p className="text-zinc-500 text-xs mt-1">Drag & drop or click to upload</p>
        </>
      )}
    </div>
  );
};

export default function App() {
  const [mode, setMode] = useState<AppMode>('outfit');
  const [personImage, setPersonImage] = useState<FileWithPreview | null>(null);
  const [outfitImage, setOutfitImage] = useState<FileWithPreview | null>(null);
  const [motionVideo, setMotionVideo] = useState<FileWithPreview | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const getApiKey = useCallback(() => {
    // The selected API key is available using process.env.API_KEY.
    // It is injected automatically by the platform.
    try {
      // Use a safe check for process.env
      const env = typeof process !== 'undefined' ? process.env : {};
      return (env as any).API_KEY || (env as any).GEMINI_API_KEY;
    } catch (e) {
      return undefined;
    }
  }, []);

  const handleGenerate = async () => {
    // For motion (Veo), we MUST have a selected key
    if (mode === 'motion' && !hasApiKey) {
      await handleOpenKeySelector();
      const nowHasKey = await window.aistudio?.hasSelectedApiKey();
      if (!nowHasKey) {
        setError("Video generation requires a paid API key. Please select one to continue.");
        return;
      }
      setHasApiKey(true);
    }

    setIsGenerating(true);
    setError(null);
    setResultUrl(null);

    try {
      const apiKey = getApiKey();
      console.log("Attempting generation with API Key:", apiKey ? "Present" : "Missing");
      
      if (!apiKey) {
        throw new Error("API Key not found. Please click 'Select Key' in the settings or footer.");
      }

      const ai = new GoogleGenAI({ apiKey });

      if (mode === 'outfit') {
        if (!personImage || !outfitImage) {
          throw new Error("Please upload both a person image and an outfit image.");
        }
        setStatusMessage("Analyzing images and changing outfit...");
        
        const personBase64 = await fileToBase64(personImage);
        const outfitBase64 = await fileToBase64(outfitImage);

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: personBase64, mimeType: personImage.type } },
              { inlineData: { data: outfitBase64, mimeType: outfitImage.type } },
              { text: "This is a photo of a person and a photo of an outfit. Please edit the person's photo so they are wearing the outfit shown in the second photo. Keep the person's pose, facial features, and background exactly the same. Only change the clothing to match the outfit reference." }
            ]
          }
        });

        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          const mimeType = imagePart.inlineData.mimeType || 'image/png';
          setResultUrl(`data:${mimeType};base64,${imagePart.inlineData.data}`);
        } else {
          throw new Error("Failed to generate edited image. The model might have blocked the request due to safety filters.");
        }

      } else if (mode === 'action-image') {
        if (!personImage || !motionVideo) {
          throw new Error("Please upload a person image and a motion video.");
        }
        setStatusMessage("Analyzing motion from video...");
        
        const videoBase64 = await fileToBase64(motionVideo);
        const personBase64 = await fileToBase64(personImage);

        // 1. Analyze video to get pose description
        const analysisResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: videoBase64, mimeType: motionVideo.type } },
              { text: "Describe the most iconic or key pose/action from this video in detail. Focus on the body position, arm/leg placement, and overall dynamic. Output only the description of this pose." }
            ]
          }
        });

        const poseDescription = analysisResponse.text;
        setStatusMessage("Generating image with your character...");

        // 2. Generate image using Gemini Image
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: personBase64, mimeType: personImage.type } },
              { text: `Edit this person's photo so they are performing the following action/pose: ${poseDescription}. Keep the person's identity, facial features, and clothing consistent. The background should remain similar or complementary.` }
            ]
          }
        });

        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          const mimeType = imagePart.inlineData.mimeType || 'image/png';
          setResultUrl(`data:${mimeType};base64,${imagePart.inlineData.data}`);
        } else {
          throw new Error("Failed to generate action image. The model might have blocked the request due to safety filters.");
        }

      } else {
        if (!personImage || !motionVideo) {
          throw new Error("Please upload a character image and a motion video.");
        }
        
        setStatusMessage("Analyzing motion with high precision...");
        
        // 1. Analyze video with Gemini 3.1 Pro for extreme detail
        const videoBase64 = await fileToBase64(motionVideo);
        const analysisResponse = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: {
            parts: [
              { inlineData: { data: videoBase64, mimeType: motionVideo.type } },
              { text: "Analyze this dance/motion video with 100% precision. Provide a second-by-second, frame-accurate breakdown of every physical movement. Describe the exact path of the limbs, the rotation of the torso, the timing of every step, and the dynamic energy. The description must be so detailed that it allows for a perfect 1:1 recreation of the original motion. Focus ONLY on the movement description." }
            ]
          }
        });

        const motionDescription = analysisResponse.text;
        setStatusMessage("Generating high-fidelity video (this may take longer)...");

        // 2. Generate video using high-quality Veo model
        const personBase64 = await fileToBase64(personImage);
        
        let operation = await ai.models.generateVideos({
          model: 'veo-3.1-generate-preview', // Switch to higher quality model
          prompt: `A professional, high-fidelity video of the person from the reference image performing the EXACT same movements as described: ${motionDescription}. The character MUST wear the exact same outfit, clothing, and accessories as shown in the reference image. The motion must be a 100% identical match to the reference video's choreography. Maintain perfect character consistency, cinematic lighting, and fluid motion.`,
          image: {
            imageBytes: personBase64,
            mimeType: personImage.type,
          },
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
          }
        });

        while (!operation.done) {
          setStatusMessage("Processing high-quality video... this usually takes 2-3 minutes.");
          await new Promise(resolve => setTimeout(resolve, 10000)); // Longer poll for high quality
          operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
          const videoResponse = await fetch(downloadLink, {
            method: 'GET',
            headers: { 'x-goog-api-key': apiKey },
          });
          
          if (!videoResponse.ok) {
            if (videoResponse.status === 403) {
              throw new Error("Permission denied when downloading video. This usually means the API key used for generation doesn't have permission to download the result. Please select a key from a paid project.");
            }
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
          }
          
          const blob = await videoResponse.blob();
          setResultUrl(URL.createObjectURL(blob));
        } else {
          throw new Error("Failed to generate video. The request might have been blocked or timed out.");
        }
      }
    } catch (err: any) {
      console.error("Generation Error:", err);
      let msg = err.message || "An unexpected error occurred.";
      
      const isPermissionError = msg.includes("403") || 
                               msg.toLowerCase().includes("permission") || 
                               err.status === 403 ||
                               (err.error && err.error.code === 403);
      const isNotFoundError = msg.toLowerCase().includes("requested entity was not found");

      if (isPermissionError) {
        setError(
          <div className="flex flex-col gap-2">
            <p><strong>Permission Denied (403).</strong> Your current API Key doesn't have permission to use this model.</p>
            <p className="text-xs opacity-80">This usually happens when using the default key for advanced models like Veo or Gemini 2.5 Image.</p>
            <button 
              onClick={handleOpenKeySelector}
              className="mt-2 bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-600 transition-colors w-fit"
            >
              Select Paid API Key
            </button>
          </div>
        );
        setHasApiKey(false);
        return;
      } else if (isNotFoundError) {
        msg = "Requested entity was not found. Your API key selection might be stale. Please click 'Select Key' to refresh your key.";
        setHasApiKey(false);
      }
      
      setError(msg);
    } finally {
      setIsGenerating(false);
      setStatusMessage("");
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = (mode === 'outfit' || mode === 'action-image') ? 'edited-image.png' : 'generated-video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (file: File, setter: React.Dispatch<React.SetStateAction<FileWithPreview | null>>) => {
    const preview = URL.createObjectURL(file);
    setter(Object.assign(file, { preview }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-900/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">AI Studio Editor</h1>
          </div>
          
          <div className="flex bg-zinc-800/50 p-1 rounded-xl border border-zinc-700/50">
            <button 
              onClick={() => setMode('outfit')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                mode === 'outfit' ? "bg-zinc-700 text-white shadow-lg" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Shirt className="w-4 h-4" /> Outfit
            </button>
            <button 
              onClick={() => setMode('action-image')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                mode === 'action-image' ? "bg-zinc-700 text-white shadow-lg" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <ImageIcon className="w-4 h-4" /> Action Image
            </button>
            <button 
              onClick={() => setMode('motion')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                mode === 'motion' ? "bg-zinc-700 text-white shadow-lg" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Play className="w-4 h-4" /> Motion Video
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left Column: Inputs */}
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">
                {mode === 'outfit' ? 'Change Your Outfit' : mode === 'action-image' ? 'Capture Action in Image' : 'Bring Photos to Life'}
              </h2>
              <p className="text-zinc-400">
                {mode === 'outfit' 
                  ? 'Upload a photo of yourself and a reference outfit to see the magic.' 
                  : mode === 'action-image'
                  ? 'Upload a photo and a video to generate an image of you in that action.'
                  : 'Upload a character photo and a video to replicate its motion.'}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Character / Person</label>
                <FileUpload 
                  onFileSelect={(f) => handleFileSelect(f, setPersonImage)}
                  accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
                  label="Person Image"
                  icon={ImageIcon}
                  preview={personImage?.preview}
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {mode === 'outfit' ? 'Outfit Reference' : 'Motion Reference'}
                </label>
                {mode === 'outfit' ? (
                  <FileUpload 
                    onFileSelect={(f) => handleFileSelect(f, setOutfitImage)}
                    accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
                    label="Outfit Image"
                    icon={Shirt}
                    preview={outfitImage?.preview}
                  />
                ) : (
                  <FileUpload 
                    onFileSelect={(f) => handleFileSelect(f, setMotionVideo)}
                    accept={{ 'video/*': ['.mp4', '.mov', '.webm'] }}
                    label="Motion Video"
                    icon={VideoIcon}
                    preview={motionVideo?.preview}
                  />
                )}
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-2xl shadow-emerald-500/10",
                  isGenerating 
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                    : "bg-emerald-500 hover:bg-emerald-400 text-black active:scale-[0.98]"
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    {statusMessage || 'Processing...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Generate {mode === 'outfit' ? 'Outfit' : mode === 'action-image' ? 'Action Image' : 'Motion Video'}
                  </>
                )}
              </button>
              
              {mode === 'motion' && !hasApiKey && (
                <p className="text-center text-xs text-zinc-500 mt-4">
                  Video generation requires a paid Gemini API key. 
                  <button onClick={handleOpenKeySelector} className="text-emerald-500 hover:underline ml-1">
                    Select Key
                  </button>
                </p>
              )}
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm text-red-200">{error}</div>
              </motion.div>
            )}
          </div>

          {/* Right Column: Result */}
          <div className="relative">
            <div className="sticky top-28">
              <div className="aspect-[4/5] rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden relative group shadow-2xl">
                <AnimatePresence mode="wait">
                  {resultUrl ? (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="w-full h-full"
                    >
                      {(mode === 'outfit' || mode === 'action-image') ? (
                        <img src={resultUrl} alt="Result" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <video src={resultUrl} className="w-full h-full object-cover" controls autoPlay loop playsInline muted />
                      )}
                      
                      <div className="absolute top-6 right-6 flex gap-2">
                        <button 
                          onClick={handleDownload}
                          className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setResultUrl(null)}
                          className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all"
                          title="Clear"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-emerald-500/90 backdrop-blur-md text-black flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-bold">Generation Complete</span>
                        </div>
                        <button onClick={handleDownload} className="text-sm font-bold underline">Save to device</button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="w-full h-full flex flex-col items-center justify-center p-12 text-center"
                    >
                      <div className="w-20 h-20 rounded-3xl bg-zinc-800 flex items-center justify-center mb-6">
                        <Sparkles className="w-10 h-10 text-zinc-600" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Ready to Create</h3>
                      <p className="text-zinc-500 text-sm max-w-xs">
                        Your generated {(mode === 'outfit' || mode === 'action-image') ? 'image' : 'video'} will appear here once processing is complete.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isGenerating && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                    <div className="relative">
                      <Loader2 className="w-16 h-16 text-emerald-500 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-emerald-500" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mt-6 mb-2">AI is Working</h3>
                    <p className="text-zinc-400 text-sm max-w-xs">{statusMessage}</p>
                    
                    <div className="mt-8 w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-emerald-500"
                        animate={{ x: [-200, 200] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Powered by Gemini 2.5 & Veo 3.1</span>
          </div>
          <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-zinc-600">
            <a href="#" className="hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Terms</a>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="hover:text-emerald-500 transition-colors">Billing Info</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
