import { useUpload } from './hooks/useUpload';
import { FileUpload } from './components/FileUpload';
import { ParsedPreview } from './components/ParsedPreview';
import './App.css';

function App() {
  const { isUploading, error, result, upload, createBlank, reset } = useUpload();

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Train Gala Planner</h1>
        <p className="app__subtitle">Upload your gala timetable or start from scratch</p>
      </header>

      <main className="app__main">
        {error && (
          <div className="app__error" role="alert">
            <p className="app__error-message">{error}</p>
            <button onClick={reset} type="button" className="app__error-btn">
              Try again
            </button>
          </div>
        )}

        {!result ? (
          <FileUpload onFileSelect={upload} isUploading={isUploading} onCreateBlank={createBlank} />
        ) : (
          <ParsedPreview result={result} onReset={reset} />
        )}
      </main>

      <footer className="app__footer">
        <p>Train Gala Planner - Plan your railway adventure</p>
      </footer>
    </div>
  );
}

export default App;
