/* ========================================
   IMAGE.JS - Image attachment & compression
   ======================================== */

const ImageManager = (() => {
  const MAX_WIDTH = 1200;
  const MAX_HEIGHT = 1200;
  const QUALITY = 0.8;
  const THUMB_SIZE = 200;

  /**
   * Pick image from file input (camera or gallery)
   */
  function pickImage(accept = 'image/*', capture = false) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      if (capture) input.capture = 'environment';
      input.multiple = true;

      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        const results = [];
        for (const file of files) {
          const processed = await processImage(file);
          results.push(processed);
        }
        resolve(results);
      };
      input.click();
    });
  }

  /**
   * Process an image file: resize and compress
   */
  function processImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Resize
          const { width, height } = calculateSize(img.width, img.height, MAX_WIDTH, MAX_HEIGHT);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress
          canvas.toBlob((blob) => {
            // Generate thumbnail
            const thumbCanvas = document.createElement('canvas');
            const thumbSize = calculateSize(img.width, img.height, THUMB_SIZE, THUMB_SIZE);
            thumbCanvas.width = thumbSize.width;
            thumbCanvas.height = thumbSize.height;
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCtx.drawImage(img, 0, 0, thumbSize.width, thumbSize.height);

            thumbCanvas.toBlob((thumbBlob) => {
              resolve({
                blob,
                thumbBlob,
                width,
                height,
                originalName: file.name
              });
            }, 'image/jpeg', 0.6);
          }, 'image/jpeg', QUALITY);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Save image to IndexedDB
   */
  async function saveImage(imageData) {
    const id = SmartMemoDB.generateId();
    const record = {
      id,
      blob: imageData.blob,
      thumbBlob: imageData.thumbBlob,
      width: imageData.width,
      height: imageData.height,
      originalName: imageData.originalName,
      createdAt: new Date().toISOString()
    };
    await SmartMemoDB.put(SmartMemoDB.STORES.IMAGES, record);
    return id;
  }

  /**
   * Get image from IndexedDB
   */
  async function getImage(id) {
    return SmartMemoDB.get(SmartMemoDB.STORES.IMAGES, id);
  }

  /**
   * Get image URL (creates ObjectURL from blob)
   */
  async function getImageUrl(id) {
    const record = await getImage(id);
    if (!record || !record.blob) return null;
    return URL.createObjectURL(record.blob);
  }

  /**
   * Get thumbnail URL
   */
  async function getThumbUrl(id) {
    const record = await getImage(id);
    if (!record) return null;
    const blob = record.thumbBlob || record.blob;
    return URL.createObjectURL(blob);
  }

  /**
   * Delete image from IndexedDB
   */
  async function deleteImage(id) {
    await SmartMemoDB.remove(SmartMemoDB.STORES.IMAGES, id);
  }

  // Helpers
  function calculateSize(w, h, maxW, maxH) {
    if (w <= maxW && h <= maxH) return { width: w, height: h };
    const ratio = Math.min(maxW / w, maxH / h);
    return {
      width: Math.round(w * ratio),
      height: Math.round(h * ratio)
    };
  }

  return {
    pickImage,
    processImage,
    saveImage,
    getImage,
    getImageUrl,
    getThumbUrl,
    deleteImage
  };
})();
