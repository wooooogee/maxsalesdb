import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { UserProvider } from './UserContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Chat from './pages/Chat';
import MeetingLog from './pages/MeetingLog';
import MapRoute from './pages/MapRoute';

function App() {
  return (
    <UserProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="meetings" element={<MeetingLog />} />
          <Route path="route" element={<MapRoute />} />
          <Route path="chat" element={<Chat />} />
        </Route>
      </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
