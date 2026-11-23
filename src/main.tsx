import { createRoot } from 'react-dom/client';
import App from './App';
import PilotPreview from './features/pilot/PilotPreview';
import './styles.css';

createRoot(document.getElementById('root')!).render(location.pathname === '/pilot' ? <PilotPreview /> : <App />);
