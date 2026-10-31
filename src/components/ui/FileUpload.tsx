import { useState } from 'react';

interface FileUploadProps {
  accept?: string;
  onFile: (file: File) => void;
  label?: string;
}

export function FileUpload({ accept = '*/*', onFile, label = 'Выберите файл' }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    onFile(f);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        className="flex items-center justify-between bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 cursor-pointer hover:border-amber-500 hover:text-white transition"
      >
        <span>{fileName || label}</span>
        <input
          type="file"
          accept={accept}
          onChange={handleChange}
          className="sr-only w-0 h-0"
        />
      </label>
      {fileName && (
        <button
          onClick={() => setFileName(null)}
          className="text-xs text-red-400 hover:underline"
        >
          Удалить файл
        </button>
      )}
    </div>
  );
}
