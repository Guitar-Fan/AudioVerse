import { Button, Group, NumberInput, Paper, SegmentedControl, Stack, Text } from '@mantine/core'

const tempoOptions = [
  { label: '90', value: '90' },
  { label: '120', value: '120' },
  { label: '140', value: '140' },
]

export function TransportControls() {
  return (
    <Paper withBorder p="md" radius="md" shadow="xs">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Button color="green" radius="md">Play</Button>
            <Button color="yellow" radius="md">Pause</Button>
            <Button color="red" radius="md">Stop</Button>
            <Button variant="light" radius="md">Record</Button>
          </Group>
          <Group gap="md">
            <Stack gap={0}>
              <Text size="sm" c="dimmed">Tempo</Text>
              <SegmentedControl size="sm" data={tempoOptions} defaultValue="120" />
            </Stack>
            <Stack gap={0}>
              <Text size="sm" c="dimmed">Time Signature</Text>
              <SegmentedControl size="sm" data={[{ label: '4/4', value: '4/4' }, { label: '3/4', value: '3/4' }]} defaultValue="4/4" />
            </Stack>
            <Stack gap={0} w={120}>
              <Text size="sm" c="dimmed">Project BPM</Text>
              <NumberInput size="sm" min={40} max={220} defaultValue={120} hideControls={false} clampBehavior="strict" radius="md" />
            </Stack>
          </Group>
        </Group>
      </Stack>
    </Paper>
  )
}
