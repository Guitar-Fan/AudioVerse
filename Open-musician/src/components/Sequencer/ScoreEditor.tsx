import { Card, Stack, Table, Text } from '@mantine/core'
import type { Clip } from '../../store/projectStore'

interface ScoreEditorProps {
  notes?: Clip['notes']
}

const formatMeasure = (value: number) => `${value.toFixed(2)} bars`

export function ScoreEditor({ notes }: ScoreEditorProps) {
  if (!notes || notes.length === 0) {
    return (
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="xs">
          <Text fw={600}>Score View</Text>
          <Text size="sm" c="dimmed">
            Select a clip that contains note data to see a structured phrase overview.
          </Text>
        </Stack>
      </Card>
    )
  }

  const sortedNotes = [...notes].sort((a, b) => a.time - b.time)

  return (
    <Card withBorder radius="md" shadow="sm">
      <Stack gap="sm">
        <Text fw={600}>Score View</Text>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Note</Table.Th>
              <Table.Th>Time</Table.Th>
              <Table.Th>Duration</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedNotes.map((note, index) => (
              <Table.Tr key={`note-${note.pitch}-${index}`}>
                <Table.Td>{note.pitch}</Table.Td>
                <Table.Td>{formatMeasure(note.time)}</Table.Td>
                <Table.Td>{formatMeasure(note.duration)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text size="xs" c="dimmed">
          Quick reference for dynamics, phrase entry points, and note lengths without leaving the main arrange view.
        </Text>
      </Stack>
    </Card>
  )
}
