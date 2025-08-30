declare global {
    interface Window {
        pdfjsLib?: any;
    }
}

export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

// Use a stable version of PDF.js that's available on CDN
const PDFJS_VERSION = '3.11.174';
let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;

    // Load PDF.js from CDN with a stable version
    loadPromise = new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.pdfjsLib) {
            pdfjsLib = window.pdfjsLib;
            isLoading = false;
            return resolve(pdfjsLib);
        }

        // Load the script
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
        script.onload = () => {
            pdfjsLib = window.pdfjsLib;
            if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
            }
            isLoading = false;
            resolve(pdfjsLib);
        };
        script.onerror = () => {
            isLoading = false;
            reject(new Error('Failed to load PDF.js'));
        };
        document.head.appendChild(script);
    });

    return loadPromise;
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        const lib = await loadPdfJs();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 2.0 }); // Reduced scale for better performance
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            return {
                imageUrl: "",
                file: null,
                error: "Failed to get canvas context",
            };
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        await page.render({
            canvasContext: context,
            viewport
        }).promise;

        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Create a File from the blob with the same name as the pdf
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: "image/png",
                        });

                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob",
                        });
                    }
                },
                "image/png",
                0.95 // Slightly reduced quality for smaller file size
            );
        });
    } catch (err) {
        console.error("PDF conversion error:", err);
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${err}`,
        };
    }
}