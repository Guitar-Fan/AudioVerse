import { Button, Group, List, Paper, Stack, TextInput, Title } from '@mantine/core'

const samples = ['Analog Kick', 'Deep Snare', 'Noise Sweeps', 'Vocal Chop']

export function ResourceBrowser() {
  return (
    <Paper withBorder p="md" radius="md" shadow="xs">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={4}>Resource Browser</Title>
          <Group gap="xs">
            <Button variant="light">Import</Button>
            <Button variant="default">Refresh</Button>
          </Group>
        </Group>
        <TextInput placeholder="Search samples, presets, MIDI..." radius="md" size="sm" />
        <List spacing="xs" size="sm">
          {samples.map((sample) => (
            <List.Item key={sample}>{sample}</List.Item>
          ))}
        </List>
      </Stack>
    </Paper>
  )
}
