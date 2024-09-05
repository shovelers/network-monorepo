import { Flex, DataList, Badge, Code, Box, Text } from '@radix-ui/themes';
import { usePrivy, useWallets, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import { programInit, AccountV1 } from 'account-fs';
import { useEffect } from 'react';
import { SiweMessage } from 'siwe';

export function User() {
  const { ready, authenticated, user, signMessage } = usePrivy();
  const { wallets } = useWallets();
  const walletReady = useWallets().ready;
  
  // Show nothing if user is not authenticated or data is still loading
  if (!(ready && authenticated) || !user) {
    return null;
  }
  
  useEffect(() => {
    if ((ready && authenticated && walletReady && user)) {
      console.log("running test after walletready :", walletReady)
      async function createAccountUsingGoogle() {
        const NETWORK = import.meta.env.VITE_NETWORK || "DEVNET"
        const program = await programInit(NETWORK)
        const account = new AccountV1(program.agent)
        
        const agentDID = await account.agent.DID()
        //call rolodex backend for nonce
        // const nonce = await getNonce();
        
        //find embedded wallet address & chainID that is signing on behalf of the user
        const embeddedWallet = getEmbeddedConnectedWallet(wallets);
        if (embeddedWallet) {
          const address = embeddedWallet.address;
          const chainId =  parseInt(embeddedWallet.chainId.split(':')[1]);

          const message = new SiweMessage({
            domain: window.location.host,
            address: address,
            statement : 'Sign in via ethereum',
            uri: window.location.origin,
            version: '1',
            chainId: chainId,
            nonce: '123456789',
            requestId: agentDID
          }).prepareMessage();

          const uiConfig = {
            title: 'Sample title text',
            description: 'Sample description text',
            buttonText: 'Sample button text',
          };

          const signature  = await signMessage(message, uiConfig);
          console.log("signature from embedded wallet :", signature)
         
          //register account on hub
          var accountDID = `did:pkh:${embeddedWallet.chainId}:${embeddedWallet.address}`
          const success = await account.create(accountDID, message, signature)
          if(success && user) {
            await account.repositories.profile.set({})
            await account.agent.appendName(user.id, 'google')
          } else {
            alert("Account creation failed. Please try again.")
            window.location.reload()
          }
        }
      }

      createAccountUsingGoogle();
    }
  }, [ready, authenticated, walletReady, user]);

  return (
    <Box className='max-w-screen-sm'>
      <Text as="div" size="4" weight="medium" align="center" mb="4"> User Details </Text>
      <DataList.Root>
        <DataList.Item align="center">
          <DataList.Label minWidth="88px">Status</DataList.Label>
          <DataList.Value>
            <Badge color="jade" variant="soft" radius="full">
              Authorized
            </Badge>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label minWidth="88px">ID</DataList.Label>
          <DataList.Value>
            <Flex align="center" gap="2">
              <Code variant="ghost">{user.id}</Code>
            </Flex>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label minWidth="88px">Wallet</DataList.Label>
          <DataList.Value>{user.wallet ? user.wallet.address : 'None'}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label minWidth="88px">AccountDID</DataList.Label>
          <DataList.Value>{user.wallet ? `DID:pkh:${user.wallet.chainId}:${user.wallet.address}` : 'None'}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label minWidth="88px">Email</DataList.Label>
          <DataList.Value>{user.email ? user.email.address : 'None'}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label minWidth="88px">Linked Accounts</DataList.Label>
          <DataList.Value>{user.linkedAccounts ? (user.linkedAccounts).map((account) => {return JSON.stringify(account)}) : 'None'}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label minWidth="88px">User Google</DataList.Label>
          <DataList.Value>{user.google ? JSON.stringify(user.google) : 'None'}</DataList.Value>
        </DataList.Item>
      </DataList.Root>
    </Box>
  )
}