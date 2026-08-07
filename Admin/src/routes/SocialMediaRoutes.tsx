import { Route, Routes } from 'react-router-dom';
import { FacebookConnectPage } from '@/pages/FacebookConnectPage';
import { YoutubeConnectPage } from '@/pages/YoutubeConnectPage';
import { InstagramConnectPage } from '@/pages/InstagramConnectPage';
import { LinkedinConnectPage } from '@/pages/LinkedinConnectPage';
import { SuccessPage } from '@/pages/SuccessPage';
import { SocialAutomationPage } from '@/pages/SocialAutomationPage';
import { SocialAutomationPostsPage } from '@/pages/SocialAutomationPostsPage';
import { SocialCategoriesPage } from '@/pages/SocialCategoriesPage';
import { SocialAccountsPage } from '@/pages/SocialAccountsPage';
import { SocialPostsPage } from '@/pages/SocialPostsPage';

export function SocialMediaRoutes() {
  return (
    <Routes>
      <Route path="/facebook" element={<FacebookConnectPage />} />
      <Route path="/youtube" element={<YoutubeConnectPage />} />
      <Route path="/instagram" element={<InstagramConnectPage />} />
      <Route path="/linkedin" element={<LinkedinConnectPage />} />
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/automation" element={<SocialAutomationPage />} />
      <Route path="/automation/:id/posts" element={<SocialAutomationPostsPage />} />
      <Route path="/mediaCategories" element={<SocialCategoriesPage />} />
      <Route path="/accounts" element={<SocialAccountsPage />} />
      <Route path="/posts" element={<SocialPostsPage />} />
    </Routes>

  );
}
