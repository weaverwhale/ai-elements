import './App.css';
import { Chatbot } from '@/components/Chatbot';
import { Route, Routes } from 'react-router';

function App() {
  return (
    <div className="app-container">
      <main>
        <Routes>
          <Route path="/" element={<Chatbot />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
