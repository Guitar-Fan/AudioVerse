import { Badge, Box, Card, Group, Stack, Text } from '@mantine/core'

interface StepSequencerProps {
  stepData?: number[][]
  laneLabels?: string[]
}

const DEFAULT_LANES = ['Kick', 'Snare', 'Hat', 'Perc']

export function StepSequencer({ stepData, laneLabels = DEFAULT_LANES }: StepSequencerProps) {
  const pattern = stepData?.length
    ? stepData
    : laneLabels.map(() => Array(16).fill(0))

  const stepsPerLane = pattern[0]?.length ?? 16
  const activeSteps = pattern.flat().filter((value) => value > 0).length

  return (
    <Card withBorder radius="md" shadow="sm">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>Step Sequencer</Text>
          <Badge color="teal" variant="light">
            {activeSteps} active steps
          </Badge>
        </Group>
        <Stack gap={8}>
          {pattern.map((lane, laneIndex) => (
            <Group key={`lane-${laneIndex}`} gap="xs" align="center" wrap="nowrap">
              <Text size="xs" fw={600} w={70} c="dimmed" ta="right">
                {laneLabels[laneIndex] ?? `Lane ${laneIndex + 1}`}
              </Text>
              <Group gap={4} className="step-row" wrap="wrap">
                {lane.map((step, stepIndex) => (
                  <Box
                    key={`step-${laneIndex}-${stepIndex}`}
                    className="step-cell"
                    data-active={step > 0}
                    title={`Step ${stepIndex + 1}`}
                  />
                ))}
              </Group>
            </Group>
          ))}
        </Stack>
        <Text size="xs" c="dimmed">
          Visualizes the clip's rhythmic grid so you can sketch grooves without opening the piano roll.
        </Text>
      </Stack>
    </Card>
  )
}
