import './App.css';
import { Chatbot } from '@/components/Chatbot';
import { GenUIViewer } from '@/components/GenUIViewer';
import { Route, Routes } from 'react-router';
import { ThemeProvider } from '@/components/theme-provider';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="ai-elements-theme">
      <div className="app-container">
        <main>
          <Routes>
            <Route path="/" element={<Chatbot />} />
            <Route path="/genui-viewer" element={<GenUIViewer />} />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
