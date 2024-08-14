import { Flex, DataList, Badge, Code, Box, Text } from '@radix-ui/themes';
import { usePrivy } from "@privy-io/react-auth";

export function User() {
  const {ready, authenticated, user} = usePrivy();

  // Show nothing if user is not authenticated or data is still loading
  if (!(ready && authenticated) || !user) {
    return null;
  }

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
      </DataList.Root>
    </Box>
  )
}