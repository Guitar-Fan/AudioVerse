import { Badge, Card, Group, Paper, SegmentedControl, Stack, Text } from '@mantine/core'

const effects = [
  { name: 'Studio Reverb', type: 'Space', status: 'Active' },
  { name: 'Tape Delay', type: 'Delay', status: 'Bypassed' },
  { name: 'Glue Compressor', type: 'Dynamics', status: 'Active' },
]

export function EffectsRack() {
  return (
    <Paper withBorder p="md" radius="md" shadow="xs">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600}>
            Effects Rack
          </Text>
          <SegmentedControl size="xs" data={[{ label: 'Insert', value: 'insert' }, { label: 'Send', value: 'send' }]} defaultValue="insert" />
        </Group>
        <Group gap="md" wrap="wrap">
          {effects.map((effect) => (
            <Card key={effect.name} withBorder p="md" radius="md" shadow="xs" style={{ minWidth: 220 }}>
              <Stack gap={4}>
                <Text fw={600}>{effect.name}</Text>
                <Text size="xs" c="dimmed">
                  Type: {effect.type}
                </Text>
                <Badge color={effect.status === 'Active' ? 'teal' : 'gray'} variant="filled" w="fit-content">
                  {effect.status}
                </Badge>
              </Stack>
            </Card>
          ))}
        </Group>
      </Stack>
    </Paper>
  )
}
