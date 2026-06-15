import React, { useRef, useMemo, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { uploadFile } from '../../lib/adminApi';

// Quill에 폰트 사이즈 등록
const Quill = ReactQuill.Quill;
const SizeStyle = Quill.import('attributors/style/size') as any;
SizeStyle.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];
Quill.register(SizeStyle, true);

const FontStyle = Quill.import('attributors/style/font') as any;
FontStyle.whitelist = ['sans-serif', 'serif', 'monospace', 'Noto Sans KR', 'Nanum Gothic', 'Nanum Myeongjo'];
Quill.register(FontStyle, true);

interface RichEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
  disableVideo?: boolean;
}

const RichEditor: React.FC<RichEditorProps> = ({ value, onChange, placeholder, minHeight = '400px', disableVideo = false }) => {
  const quillRef = useRef<ReactQuill>(null);

  // 이미지 업로드 핸들러
  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*,.gif');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > 3 * 1024 * 1024) {
        alert('사진의 최대 업로드 가능한 크기는 3MB입니다.');
        return;
      }

      // GIF는 애니메이션 보존을 위해 원본 그대로 업로드
      if (file.type === 'image/gif') {
        try {
          const url = await uploadFile(file, 'editor_images');
          const quill = quillRef.current?.getEditor();
          if (quill) {
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', url);
            quill.setSelection(range.index + 1, 0);
          }
        } catch (err) {
          console.error('Image upload failed:', err);
          alert('이미지 업로드에 실패했습니다.');
        }
        return;
      }

      // 그 외 일반 이미지(JPEG, PNG 등)는 해상도 유지한 채 WebP로 포맷 변환 및 압축
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);

          // WebP 변환 (품질 80%)
          canvas.toBlob(async (blob) => {
            if (!blob) return;
            // WebP 확장자로 변경
            const newFilename = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const webpFile = new File([blob], newFilename, { type: 'image/webp' });
            
            try {
              const url = await uploadFile(webpFile, 'editor_images');
              const quill = quillRef.current?.getEditor();
              if (quill) {
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', url);
                quill.setSelection(range.index + 1, 0);
              }
            } catch (err) {
              console.error('Image upload failed:', err);
              alert('이미지 업로드에 실패했습니다.');
            }
          }, 'image/webp', 0.8);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    };
  }, []);

  // 비디오 핸들러: disableVideo=true이면 삽입 차단, false이면 URL 입력 받아 iframe으로 직접 삽입
  // insertEmbed('video') 는 react-quill-new에서 링크로 잘못 삽입되는 버그가 있어
  // dangerouslyPasteHTML로 iframe 태그를 직접 주입함
  const videoHandler = useCallback(() => {
    if (disableVideo) {
      alert('게시글에는 iframe 및 비디오를 삽입할 수 없습니다.');
      return;
    }
    const url = prompt('비디오 URL을 입력하세요 (YouTube embed URL 등):');
    if (!url || !url.trim()) return;
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection(true);
      // video blot 대신 iframe HTML을 직접 주입
      quill.clipboard.dangerouslyPasteHTML(
        range.index,
        `<iframe class="ql-video" src="${url.trim()}" frameborder="0" allowfullscreen="true"></iframe>`
      );
      // iframe 이후 커서 이동
      setTimeout(() => quill.setSelection(range.index + 1, 0), 0);
    }
  }, [disableVideo]);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ font: FontStyle.whitelist }],
        [{ size: SizeStyle.whitelist }],
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video'],
        ['clean'],
      ],
      handlers: {
        image: imageHandler,
        video: videoHandler,
      },
    },
  }), [imageHandler, videoHandler]);

  const formats = [
    'font', 'size', 'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'align',
    'list', 'indent',
    'blockquote', 'code-block',
    'link', 'image', 'video',
  ];

  return (
    <div className="rich-editor-wrapper" style={{ minHeight }}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{ minHeight: `calc(${minHeight} - 42px)` }}
      />
    </div>
  );
};

export default RichEditor;
