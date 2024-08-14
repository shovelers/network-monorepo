import { Button, Card, Flex, Heading } from '@radix-ui/themes';
import { Icon } from '@iconify/react';
import { usePrivy } from "@privy-io/react-auth";
import { User } from './User.tsx'

function App() {
  const { ready, authenticated, login, logout } = usePrivy();
  const disableLogin = !ready || (ready && authenticated);
  const disableLogout = !ready || (ready && !authenticated);
  
  return (
    <Flex direction="column" align="center" justify="center" gap="2" p="4" className="min-h-screen">
      <Heading as='h2' weight="medium">Login with Privy</Heading>
      <Button size="3" variant='outline' color='gray' radius='full' disabled={disableLogin} onClick={login}>
        <Icon icon="bi:search" width="16" height="16"  style={{color: "white"}} />
        Login
      </Button>
      <Card size="3">
        <Flex gap="4" align="center">
          {User()}
        </Flex>
      </Card>
      <Button size="3" variant='outline' color='gray' radius='full' disabled={disableLogout} onClick={logout}>
        <Icon icon="bi:search" width="16" height="16"  style={{color: "white"}} />
        Logout
      </Button>
    </Flex>
  )
}

export default App
