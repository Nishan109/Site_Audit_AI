import { imageFileError, type CreativeAsset } from "./ad-studio";

export async function readCreativeImage(file: File): Promise<CreativeAsset> {
  const error = imageFileError(file);
  if (error) throw new Error(error);
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reader.onabort = () =>
      reject(new Error("This image couldn’t be read. Choose another file."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "This file isn’t a readable image. Try another PNG, JPG, or WebP file.",
        ),
      );
    image.src = src;
  });
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error(
      "This image has no readable dimensions. Choose another file.",
    );
  return {
    src,
    name: file.name,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}
