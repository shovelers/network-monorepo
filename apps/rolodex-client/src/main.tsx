import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import {PrivyProvider} from '@privy-io/react-auth';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme appearance='dark' className='flex items-center justify-center'>
     <PrivyProvider
      appId={privyAppId}
     >
       <App />
     </PrivyProvider>
    </Theme>
  </StrictMode>,
)
