import { Card, Group, Paper, Stack, Text } from '@mantine/core'

const instruments = [
  { name: 'Granular Pad', engine: 'Wavetable' },
  { name: 'FM Keys', engine: 'FM' },
  { name: 'Analog Bass', engine: 'Subtractive' },
]

export function InstrumentsPanel() {
  return (
    <Paper withBorder p="md" radius="md" shadow="xs">
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          Instruments
        </Text>
        <Group gap="md" wrap="wrap">
          {instruments.map((instrument) => (
            <Card key={instrument.name} withBorder p="md" radius="md" shadow="xs" style={{ minWidth: 200 }}>
              <Stack gap={4}>
                <Text fw={600}>{instrument.name}</Text>
                <Text size="xs" c="dimmed">
                  Engine: {instrument.engine}
                </Text>
              </Stack>
            </Card>
          ))}
        </Group>
      </Stack>
    </Paper>
  )
}
