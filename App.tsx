import React, { useState, useCallback, DragEvent } from 'react';
import { removeBackground } from './services/geminiService';

// --- Utility Function ---
const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mimeType = header?.match(/:(.*?);/)?.[1];
      if (base64 && mimeType) {
        resolve({ base64, mimeType });
      } else {
        reject(new Error("Failed to parse file data URL."));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- Main App Component ---
export default function App() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // State for new background options
  const [backgroundType, setBackgroundType] = useState<'transparent' | 'color' | 'image'>('transparent');
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFFFFF');
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string | null>(null);
  
  // State to control background editor visibility
  const [showBackgroundEditor, setShowBackgroundEditor] = useState<boolean>(false);


  const handleFileSelect = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      handleReset();
      setOriginalFile(file);
      setOriginalImagePreview(URL.createObjectURL(file));
      setError(null);
    } else {
      setError("Please select a valid image file (PNG, JPG, etc.).");
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    handleFileSelect(file || null);
    event.target.value = '';
  };

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    handleFileSelect(file || null);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(true);
  }, []);
  
  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
  }, []);

  const handleRemoveBackground = async () => {
    if (!originalFile) {
      setError("No image selected.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setProcessedImage(null);
    setShowBackgroundEditor(false);

    try {
      const { base64, mimeType } = await fileToBase64(originalFile);
      const resultBase64 = await removeBackground(base64, mimeType);
      setProcessedImage(`data:image/png;base64,${resultBase64}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = useCallback(async () => {
    if (!processedImage || !originalFile) return;

    const foreground = new Image();
    foreground.crossOrigin = 'anonymous';

    const getCanvas = (): Promise<HTMLCanvasElement> => new Promise((resolve, reject) => {
        foreground.onload = () => {
            const canvas = document.createElement('canvas');
            const targetWidth = foreground.naturalWidth > 0 ? foreground.naturalWidth : 1024;
            const targetHeight = foreground.naturalHeight > 0 ? foreground.naturalHeight : 1024;
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Could not get canvas context"));

            // Step 1: Draw Background
            if (backgroundType === 'color') {
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(foreground, 0, 0);
                resolve(canvas);
            } else if (backgroundType === 'image' && backgroundImagePreview) {
                const background = new Image();
                background.crossOrigin = 'anonymous';
                background.onload = () => {
                    const hRatio = canvas.width / background.naturalWidth;
                    const vRatio = canvas.height / background.naturalHeight;
                    const ratio = Math.max(hRatio, vRatio);
                    const centerShiftX = (canvas.width - background.naturalWidth * ratio) / 2;
                    const centerShiftY = (canvas.height - background.naturalHeight * ratio) / 2;
                    ctx.drawImage(background, 0, 0, background.naturalWidth, background.naturalHeight, centerShiftX, centerShiftY, background.naturalWidth * ratio, background.naturalHeight * ratio);
                    ctx.drawImage(foreground, 0, 0);
                    resolve(canvas);
                };
                background.onerror = () => reject(new Error("Background image failed to load for download."));
                background.src = backgroundImagePreview;
            } else { // Transparent background
                ctx.drawImage(foreground, 0, 0);
                resolve(canvas);
            }
        };
        foreground.onerror = () => reject(new Error("Foreground image failed to load for download."));
        foreground.src = processedImage;
    });

    try {
        const canvas = await getCanvas();
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        const name = originalFile.name.split('.').slice(0, -1).join('.');
        link.download = `${name}_processed.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate image for download.");
    }
}, [processedImage, originalFile, backgroundType, backgroundColor, backgroundImagePreview]);
  
  const handleReset = () => {
    setOriginalFile(null);
    if(originalImagePreview) {
        URL.revokeObjectURL(originalImagePreview);
    }
    setOriginalImagePreview(null);
    setProcessedImage(null);
    setIsLoading(false);
    setError(null);
    setDragOver(false);
    setBackgroundType('transparent');
    setBackgroundColor('#FFFFFF');
    if (backgroundImagePreview) {
        URL.revokeObjectURL(backgroundImagePreview);
    }
    setBackgroundImagePreview(null);
    setShowBackgroundEditor(false);
  };
  
  const handleBackgroundImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
          if (backgroundImagePreview) {
              URL.revokeObjectURL(backgroundImagePreview);
          }
          setBackgroundImagePreview(URL.createObjectURL(file));
          setBackgroundType('image');
          setError(null);
      } else {
          setError("Please select a valid background image file.");
      }
      event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <Header />
      <main className="w-full max-w-6xl flex-grow flex flex-col items-center justify-center">
        {!originalImagePreview ? (
            <ImageUploader 
                onDrop={handleDrop} 
                onDragOver={handleDragOver} 
                onDragLeave={handleDragLeave} 
                onFileChange={handleFileChange}
                dragOver={dragOver} 
            />
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
              <ImageDisplay title="Original" foregroundUrl={originalImagePreview} />
              <ImageDisplay 
                title="Result" 
                foregroundUrl={processedImage} 
                isLoading={isLoading} 
                onDownload={handleDownload}
                backgroundType={backgroundType}
                backgroundColor={backgroundColor}
                backgroundImageUrl={backgroundImagePreview}
              />
            </div>

            {processedImage && !isLoading && showBackgroundEditor && (
              <BackgroundEditor
                backgroundType={backgroundType}
                onTypeChange={setBackgroundType}
                color={backgroundColor}
                onColorChange={(e) => { setBackgroundColor(e.target.value); setBackgroundType('color'); }}
                onSwatchClick={(color) => { setBackgroundColor(color); setBackgroundType('color'); }}
                onImageChange={handleBackgroundImageChange}
              />
            )}
            
            <div className="flex items-center space-x-4 mt-8">
                { !processedImage ? (
                    <button
                        onClick={handleRemoveBackground}
                        disabled={isLoading}
                        className="bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center"
                    >
                        {isLoading ? <SpinnerIcon /> : <SparklesIcon />}
                        <span className="ml-2">{isLoading ? 'Processing...' : 'Remove Background'}</span>
                    </button>
                ) : !isLoading && (
                     <button
                        onClick={() => setShowBackgroundEditor(p => !p)}
                        className="bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-purple-500 transition-all duration-300 transform hover:scale-105 flex items-center"
                    >
                        <PaintBrushIcon />
                        <span className="ml-2">{showBackgroundEditor ? 'Hide Editor' : 'Edit Background'}</span>
                    </button>
                )}
                 <button
                    onClick={handleReset}
                    className="bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-slate-600 transition-all duration-300 flex items-center"
                 >
                    <TrashIcon />
                    <span className="ml-2">Start Over</span>
                 </button>
            </div>
          </div>
        )}
        {error && (
            <div className="mt-6 bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-center" role="alert">
                <p>{error}</p>
            </div>
        )}
      </main>
       <footer className="w-full text-center py-4 mt-8">
        <p className="text-sm text-slate-500">Powered by Gemini AI</p>
      </footer>
    </div>
  );
}


// --- Child & Icon Components ---

const Header: React.FC = () => (
    <header className="w-full max-w-6xl mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 flex items-center justify-center gap-3">
            <SparklesIcon />
            AI Background Remover
        </h1>
        <p className="mt-2 text-lg text-slate-400">
            Upload an image, remove the background, and add your own creative touch.
        </p>
    </header>
);

interface ImageUploaderProps {
    onDrop: (event: DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    dragOver: boolean;
}
const ImageUploader: React.FC<ImageUploaderProps> = ({ onDrop, onDragOver, onDragLeave, onFileChange, dragOver }) => (
    <div 
        onDrop={onDrop} 
        onDragOver={onDragOver} 
        onDragLeave={onDragLeave}
        className={`relative w-full max-w-xl border-4 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer 
        ${dragOver ? 'border-indigo-500 bg-slate-800/50' : 'border-slate-700 hover:border-indigo-600 hover:bg-slate-800/30'}`}
    >
        <input
            type="file"
            id="file-upload"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={onFileChange}
            accept="image/*"
        />
        <label htmlFor="file-upload" className="flex flex-col items-center justify-center space-y-4 cursor-pointer">
            <UploadIcon />
            <p className="text-xl font-semibold text-slate-300">Drag & drop your image here</p>
            <p className="text-slate-500">or</p>
            <span className="bg-slate-700 text-white font-medium py-2 px-5 rounded-lg hover:bg-slate-600 transition-colors">
                Browse Files
            </span>
        </label>
    </div>
);

interface ImageDisplayProps {
    title: string;
    foregroundUrl: string | null;
    isLoading?: boolean;
    onDownload?: () => void;
    backgroundType?: 'transparent' | 'color' | 'image';
    backgroundColor?: string;
    backgroundImageUrl?: string | null;
}
const ImageDisplay: React.FC<ImageDisplayProps> = ({ title, foregroundUrl, isLoading, onDownload, backgroundType = 'transparent', backgroundColor = '#FFFFFF', backgroundImageUrl = null }) => {
    const containerStyle: React.CSSProperties = {};
    let containerClasses = "aspect-square w-full rounded-lg bg-slate-900 flex items-center justify-center relative transition-colors duration-300";

    if (backgroundType === 'transparent') {
        containerClasses += " checkerboard";
    } else if (backgroundType === 'color') {
        containerStyle.backgroundColor = backgroundColor;
    } else if (backgroundType === 'image' && backgroundImageUrl) {
        containerStyle.backgroundImage = `url(${backgroundImageUrl})`;
        containerStyle.backgroundSize = 'cover';
        containerStyle.backgroundPosition = 'center';
    }

    return (
        <div className="bg-slate-800 p-4 rounded-xl shadow-2xl flex flex-col">
            <h3 className="text-lg font-bold text-center mb-4 text-slate-300">{title}</h3>
            <div className={containerClasses} style={containerStyle}>
                {isLoading && (
                    <div className="absolute inset-0 bg-slate-900/70 flex flex-col items-center justify-center rounded-lg z-10">
                        <SpinnerIcon />
                        <p className="mt-2 text-slate-400">Removing background...</p>
                    </div>
                )}
                {foregroundUrl ? (
                    <img src={foregroundUrl} alt={title} className="max-w-full max-h-full object-contain relative z-0" />
                ) : (
                    !isLoading && <div className="text-slate-500">Your result will appear here</div>
                )}
            </div>
            {onDownload && foregroundUrl && !isLoading && (
                 <button
                    onClick={onDownload}
                    className="mt-4 w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-500 transition-colors flex items-center justify-center"
                >
                    <DownloadIcon />
                    <span className="ml-2">Download</span>
                </button>
            )}
        </div>
    );
};


interface BackgroundEditorProps {
    backgroundType: 'transparent' | 'color' | 'image';
    onTypeChange: (type: 'transparent' | 'color' | 'image') => void;
    color: string;
    onColorChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onSwatchClick: (color: string) => void;
    onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const BackgroundEditor: React.FC<BackgroundEditorProps> = ({ backgroundType, onTypeChange, color, onColorChange, onSwatchClick, onImageChange }) => {
    const colorSwatches = ['#FFFFFF', '#000000', '#EF4444', '#3B82F6', '#22C55E', '#EAB308', '#8B5CF6'];
    
    const TabButton: React.FC<{ type: 'transparent' | 'color' | 'image', children: React.ReactNode }> = ({ type, children }) => (
        <button
            onClick={() => onTypeChange(type)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                backgroundType === type
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
        >
            {children}
        </button>
    );

    return (
        <div className="w-full max-w-2xl mt-8 p-4 bg-slate-800 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold text-center mb-4 text-slate-200">Edit Background</h3>
            <div className="flex justify-center items-center gap-2 mb-4">
                <TabButton type="transparent">Transparent</TabButton>
                <TabButton type="color">Color</TabButton>
                <TabButton type="image">Image</TabButton>
            </div>
            <div className="pt-4 border-t border-slate-700">
                {backgroundType === 'color' && (
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-slate-400">Choose a background color:</p>
                        <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 rounded-full border-2 border-slate-600 overflow-hidden">
                                <input
                                    type="color"
                                    value={color}
                                    onChange={onColorChange}
                                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                                    aria-label="Color Picker"
                                />
                                <div className="w-full h-full" style={{ backgroundColor: color }}></div>
                            </div>
                            <div className="flex gap-2">
                                {colorSwatches.map(swatch => (
                                    <button
                                        key={swatch}
                                        onClick={() => onSwatchClick(swatch)}
                                        className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${color === swatch ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-indigo-500' : ''}`}
                                        style={{ backgroundColor: swatch }}
                                        aria-label={`Color swatch ${swatch}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                 {backgroundType === 'image' && (
                    <div className="flex flex-col items-center gap-3">
                         <p className="text-slate-400">Choose a background image:</p>
                        <label className="bg-slate-700 text-white font-medium py-2 px-5 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer flex items-center gap-2">
                            <UploadIcon />
                            Upload Image
                            <input
                                type="file"
                                className="hidden"
                                onChange={onImageChange}
                                accept="image/*"
                            />
                        </label>
                    </div>
                )}
                 {backgroundType === 'transparent' && (
                    <p className="text-center text-slate-400">The background is transparent. Perfect for layering!</p>
                 )}
            </div>
        </div>
    );
}

const UploadIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const DownloadIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
const SparklesIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>;
const SpinnerIcon: React.FC = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const TrashIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PaintBrushIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
