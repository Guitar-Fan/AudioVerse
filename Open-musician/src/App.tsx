import { AppShell, Badge, Burger, Button, Group, Stack, Text, Title } from '@mantine/core'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
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
import { useUIStore } from './store/uiStore'

function App() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)

  useAudioEngine()

  return (
    <AppShell
      padding={0}
      header={{ height: 64 }}
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

      <AppShell.Main>
        <Stack gap="sm" p="md">
          <TransportControls />

          <PanelGroup direction="horizontal" className="panel-group">
            <Panel defaultSize={75} minSize={60} className="panel">
              <ArrangeView />
            </Panel>
            <PanelResizeHandle className="panel-resize-handle" />
            <Panel defaultSize={25} minSize={15} className="panel">
              <Stack gap="sm">
                <ResourceBrowser />
                <InstrumentsPanel />
              </Stack>
            </Panel>
          </PanelGroup>

          <PanelGroup direction="horizontal" className="panel-group">
            <Panel defaultSize={65} minSize={45} className="panel">
              <PianoRollEditor />
            </Panel>
            <PanelResizeHandle className="panel-resize-handle" />
            <Panel defaultSize={35} minSize={25} className="panel">
              <MixerPanel />
            </Panel>
          </PanelGroup>

          <EffectsRack />
        </Stack>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
