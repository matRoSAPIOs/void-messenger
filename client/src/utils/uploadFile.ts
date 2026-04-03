export async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'void_messenger');
    formData.append('cloud_name', 'dld14iqdc');
  
    const res = await fetch('https://api.cloudinary.com/v1_1/dld14iqdc/auto/upload', {
      method: 'POST',
      body: formData,
    });
  
    const data = await res.json();
    return data.secure_url;
  }