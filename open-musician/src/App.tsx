import { AppShell, Badge, Burger, Button, Group, ScrollArea, Stack, Text, Title } from '@mantine/core'
import {
  ArrangeView,
  EffectsRack,
  InstrumentsPanel,
  MixerPanel,
  PianoRollEditor,
  ResourceBrowser,
  TransportControls,
} from './components'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useProjectStore } from './store/projectStore'
import { useUIStore } from './store/uiStore'

function App() {
  const tracks = useProjectStore((state) => state.tracks)
  const selectedTrackId = useProjectStore((state) => state.selectedTrackId)
  const selectTrack = useProjectStore((state) => state.selectTrack)
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)

  useAudioEngine()

  return (
    <AppShell
      padding="md"
      header={{ height: 64 }}
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !sidebarOpen } }}
      styles={{ main: { backgroundColor: 'transparent' } }}
    >
      <AppShell.Header>
        <Group justify="space-between" align="center" px="md" h="100%">
          <Group gap="xs">
            <Burger opened={sidebarOpen} onClick={toggleSidebar} hiddenFrom="sm" size="sm" />
            <div>
              <Title order={4}>Open Musician</Title>
              <Text size="xs" c="dimmed">
                Open-source workstation powered by Mantine + Tone.js
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Badge color="teal" variant="light">
              Draft Session
            </Badge>
            <Button variant="gradient" gradient={{ from: 'orange', to: 'cyan' }}>
              Save Project
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="sm" h="100%">
          <Text size="sm" fw={600}>
            Tracks
          </Text>
          <ScrollArea>
            <Stack gap="xs">
              {tracks.map((track) => (
                <Button
                  key={track.id}
                  variant={selectedTrackId === track.id ? 'light' : 'subtle'}
                  onClick={() => selectTrack(track.id)}
                  justify="space-between"
                >
                  <span>{track.name}</span>
                  <Badge variant="dot" color={track.type === 'audio' ? 'cyan' : 'grape'}>
                    {track.type}
                  </Badge>
                </Button>
              ))}
            </Stack>
          </ScrollArea>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Stack gap="md">
          <TransportControls />
          <Group align="flex-start" gap="md" grow>
            <ArrangeView />
            <ResourceBrowser />
          </Group>
          <Group align="flex-start" gap="md" grow>
            <PianoRollEditor />
            <MixerPanel />
          </Group>
          <Group align="flex-start" gap="md" grow>
            <EffectsRack />
            <InstrumentsPanel />
          </Group>
        </Stack>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
