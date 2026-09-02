export interface ImageMeta {
  width: number;
  height: number;
  orientation: number;
  fileSize: number;
  mimeType: string;
  lastModified: number;
  name: string;
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  lensModel?: string;
  whiteBalance?: string;
  flash?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  copyright?: string;
  artist?: string;
  imageDescription?: string;
  xResolution?: number;
  yResolution?: number;
  resolutionUnit?: string;
  colorSpace?: string;
  exposureProgram?: string;
  meteringMode?: string;
  lightSource?: string;
  sensingMethod?: string;
  customRendered?: string;
  exposureMode?: string;
  digitalZoomRatio?: string;
  sceneCaptureType?: string;
  contrast?: string;
  saturation?: string;
  sharpness?: string;
  subjectDistanceRange?: string;
}

import exifr from "exifr";

export async function readImageMeta(file: File): Promise<ImageMeta> {
  const orientation = 1;
  let width = 0;
  let height = 0;

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("无法加载图片"));
        img.src = url;
      });
      width = img.naturalWidth;
      height = img.naturalHeight;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  const base: ImageMeta = {
    width,
    height,
    orientation: 1,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    lastModified: file.lastModified,
    name: file.name,
  };

  try {
    const exif = await exifr.parse(file, {
      pick: [
        "Make",
        "Model",
        "Software",
        "DateTimeOriginal",
        "ExposureTime",
        "FNumber",
        "ISO",
        "FocalLength",
        "LensModel",
        "WhiteBalance",
        "Flash",
        "GPSLatitude",
        "GPSLongitude",
        "GPSAltitude",
        "Copyright",
        "Artist",
        "ImageDescription",
        "XResolution",
        "YResolution",
        "ResolutionUnit",
        "ColorSpace",
        "ExposureProgram",
        "MeteringMode",
        "LightSource",
        "SensingMethod",
        "CustomRendered",
        "ExposureMode",
        "DigitalZoomRatio",
        "SceneCaptureType",
        "Contrast",
        "Saturation",
        "Sharpness",
        "SubjectDistanceRange",
        "Orientation",
      ],
    });

    if (!exif) return base;

    return {
      ...base,
      make: exif.Make as string | undefined,
      model: exif.Model as string | undefined,
      software: exif.Software as string | undefined,
      dateTime: exif.DateTimeOriginal
        ? new Date(exif.DateTimeOriginal).toLocaleString()
        : undefined,
      exposureTime: exif.ExposureTime
        ? (exif.ExposureTime as number) < 1
          ? `1/${Math.round(1 / (exif.ExposureTime as number))}s`
          : `${exif.ExposureTime}s`
        : undefined,
      fNumber: exif.FNumber ? `f/${exif.FNumber}` : undefined,
      iso: exif.ISO as number | undefined,
      focalLength: exif.FocalLength ? `${exif.FocalLength}mm` : undefined,
      lensModel: exif.LensModel as string | undefined,
      whiteBalance:
        exif.WhiteBalance === 0
          ? "自动"
          : exif.WhiteBalance === 1
            ? "手动"
            : undefined,
      flash: exif.Flash as string | undefined,
      gpsLatitude: exif.GPSLatitude as number | undefined,
      gpsLongitude: exif.GPSLongitude as number | undefined,
      gpsAltitude: exif.GPSAltitude as number | undefined,
      copyright: exif.Copyright as string | undefined,
      artist: exif.Artist as string | undefined,
      imageDescription: exif.ImageDescription as string | undefined,
      xResolution: exif.XResolution as number | undefined,
      yResolution: exif.YResolution as number | undefined,
      resolutionUnit: exif.ResolutionUnit as string | undefined,
      colorSpace: exif.ColorSpace as string | undefined,
      exposureProgram: exif.ExposureProgram as string | undefined,
      meteringMode: exif.MeteringMode as string | undefined,
      lightSource: exif.LightSource as string | undefined,
      sensingMethod: exif.SensingMethod as string | undefined,
      customRendered: exif.CustomRendered as string | undefined,
      exposureMode: exif.ExposureMode as string | undefined,
      digitalZoomRatio: exif.DigitalZoomRatio as string | undefined,
      sceneCaptureType: exif.SceneCaptureType as string | undefined,
      contrast: exif.Contrast as string | undefined,
      saturation: exif.Saturation as string | undefined,
      sharpness: exif.Sharpness as string | undefined,
      subjectDistanceRange: exif.SubjectDistanceRange as string | undefined,
    };
  } catch {
    return base;
  }
}

export function formatMetaDate(timestamp: number): string {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  return d.toLocaleString();
}
