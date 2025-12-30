import { Paper, ScrollArea, Table, Text } from '@mantine/core'

const notes = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3']

export function PianoRollEditor() {
  return (
    <Paper withBorder p="md" radius="md" shadow="xs">
      <Text size="sm" fw={600} mb="sm">
        Piano Roll
      </Text>
      <ScrollArea h={200} offsetScrollbars>
        <Table highlightOnHover>
          <Table.Tbody>
            {notes.map((note) => (
              <Table.Tr key={note}>
                <Table.Td style={{ width: 60 }}>{note}</Table.Td>
                <Table.Td>
                  <div className="piano-roll-row">
                    {[...Array(16)].map((_, index) => (
                      <span key={`${note}-${index}`} className="piano-roll-cell" />
                    ))}
                  </div>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  )
}
