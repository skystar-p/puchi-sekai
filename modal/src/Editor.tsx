import './editor.css'

import { EditorProvider } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const extensions = [
  StarterKit.configure({
    bulletList: {
      keepMarks: true,
      keepAttributes: false,
    },
    orderedList: {
      keepMarks: true,
      keepAttributes: false,
    },
  }),
];

export default () => {
  return (
    <EditorProvider extensions={extensions}></EditorProvider>
  );
}
