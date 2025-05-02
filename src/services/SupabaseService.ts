import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lmsyciacrkoskihgtvbb.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const bucket: string = import.meta.env.VITE_SUPABASE_BUCKET;

function getFileExtension(file: File) {
  const mimeType = file.type;
  console.log(mimeType);
  
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      console.log(23232);
      
      throw new Error("Unsupported image format");
  }
}

export function constructFilePath(file: File, userAddress: string): string {
  const ext = getFileExtension(file);
  const timestamp = new Date().getTime();
  const folder = `${userAddress.substring(0, 10)}_${timestamp}`;
  const filePath = `images/${folder}/image.${ext}`;

  return filePath;
}

//upload image
//here, the path should be the images/${question_id}/image.jpg
//questionID is the id of a question(see suiquora.move)
export async function uploadImage(file: File, filePath: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      //cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`failed in uploading image: ${error.message}`);
  }

  return data;
}

// //update image in the bucket
// export async function updateImage(file: File, path: string) {
//   const { data, error } = await supabase.storage
//     .from(bucket)
//     .upload(path, file, {
//       //cacheControl: "3600",
//       upsert: true,
//     });

//   if (error) {
//     throw new Error(`更新失败: ${error.message}`);
//   }

//   return data;
// }

//get image url by path in the bucket
export function getPublicUrl(path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  return data.publicUrl;
}
