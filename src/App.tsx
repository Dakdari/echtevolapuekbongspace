import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import BoardList from './pages/BoardList';
import Board from './pages/Board';
import PostWrite from './pages/PostWrite';
import PostView from './pages/PostView';
import Market from './pages/Market';
import Admin from './pages/Admin';
import FooterPage from './pages/FooterPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin" element={<Admin />} />
          <Route path="boards" element={<BoardList />} />
          <Route path="market" element={<Market />} />
          <Route path="page/:slug" element={<FooterPage />} />
          <Route path=":boardId" element={<Board />} />
          <Route path=":boardId/write" element={<PostWrite />} />
          <Route path=":boardId/:postId" element={<PostView />} />
          <Route path="*" element={<div style={{ textAlign: 'center', marginTop: '5rem' }}><h2>404 - Page Not Found</h2></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
