import { Card, Group, Slider, Stack, Text } from '@mantine/core'

const channels = ['Drums', 'Bass', 'Synth', 'Vox']

export function MixerPanel() {
  return (
    <Group wrap="wrap" align="stretch" gap="md">
      {channels.map((channel) => (
        <Card key={channel} withBorder radius="md" padding="md" shadow="sm" style={{ minWidth: 180 }}>
          <Stack gap="sm">
            <Text fw={600}>{channel}</Text>
            <Stack gap={4} align="center">
              <Text size="xs" c="dimmed">Volume</Text>
              <Slider orientation="vertical" min={0} max={100} defaultValue={50} h={180} size="lg" />
            </Stack>
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Pan</Text>
              <Slider min={-100} max={100} defaultValue={0} step={10} marks={[{ value: 0 }]} />
            </Stack>
          </Stack>
        </Card>
      ))}
    </Group>
  )
}
