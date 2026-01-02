import {
  ActionIcon,
  Badge,
  Card,
  ColorSwatch,
  Group,
  Slider,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconVolume, IconVolume3, IconWaveSine, IconWaveSquare } from '@tabler/icons-react'
import { useProjectStore } from '../../store/projectStore'

export function MixerPanel() {
  const tracks = useProjectStore((state) => state.tracks)
  const setTrackVolume = useProjectStore((state) => state.setTrackVolume)
  const setTrackPan = useProjectStore((state) => state.setTrackPan)
  const toggleTrackMute = useProjectStore((state) => state.toggleTrackMute)
  const toggleTrackSolo = useProjectStore((state) => state.toggleTrackSolo)
  const toggleTrackArm = useProjectStore((state) => state.toggleTrackArm)
  const setSendLevel = useProjectStore((state) => state.setSendLevel)

  return (
    <Group wrap="wrap" align="stretch" gap="md">
      {tracks.map((track) => {
        const primarySend = track.sends[0]
        return (
          <Card key={track.id} withBorder radius="md" padding="md" shadow="sm" style={{ minWidth: 200 }}>
            <Stack gap="sm">
              <Group gap="xs" align="center" justify="space-between">
                <Group gap={6} align="center">
                  <ColorSwatch color={track.color} size={14} withShadow={false} radius="xs" />
                  <Text fw={600}>{track.name}</Text>
                  <Badge size="xs" variant="dot" color={track.type === 'audio' ? 'cyan' : track.type === 'master' ? 'gray' : 'grape'}>
                    {track.type}
                  </Badge>
                </Group>
                <Group gap={4}>
                  <Tooltip label="Mute">
                    <ActionIcon
                      size="sm"
                      variant={track.muted ? 'filled' : 'light'}
                      color="red"
                      onClick={() => toggleTrackMute(track.id)}
                    >
                      M
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Solo">
                    <ActionIcon
                      size="sm"
                      variant={track.solo ? 'filled' : 'light'}
                      color="yellow"
                      onClick={() => toggleTrackSolo(track.id)}
                    >
                      S
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Arm">
                    <ActionIcon
                      size="sm"
                      variant={track.armed ? 'filled' : 'light'}
                      color="teal"
                      onClick={() => toggleTrackArm(track.id)}
                    >
                      R
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <Group gap="xs" align="center" wrap="wrap">
                {track.instrumentId && (
                  <Badge size="xs" color="violet" leftSection={<IconWaveSine size={12} />}>
                    {track.instrumentId}
                  </Badge>
                )}
                {track.effects.length > 0 && (
                  <Badge size="xs" color="orange" leftSection={<IconWaveSquare size={12} />}>
                    FX {track.effects.length}
                  </Badge>
                )}
                {track.outputId && (
                  <Badge size="xs" variant="outline" color="gray">
                    Out {track.outputId}
                  </Badge>
                )}
              </Group>

              <Group gap="lg" align="flex-end" justify="space-between">
                <Stack gap={4} align="center">
                  <Text size="xs" c="dimmed">
                    Volume
                  </Text>
                  <Slider
                    orientation="vertical"
                    min={0}
                    max={100}
                    value={Math.round(track.volume * 100)}
                    onChange={(value) => setTrackVolume(track.id, value / 100)}
                    h={180}
                    size="lg"
                  />
                  <Text size="xs" fw={600}>
                    {Math.round(track.volume * 100)}%
                  </Text>
                </Stack>

                <Stack gap="xs" style={{ flex: 1 }}>
                  <Group gap={4} align="center" justify="space-between">
                    <Text size="xs" c="dimmed">
                      Pan
                    </Text>
                    <Text size="xs" fw={600}>
                      {track.pan}
                    </Text>
                  </Group>
                  <Slider
                    min={-100}
                    max={100}
                    value={track.pan}
                    step={2}
                    marks={[{ value: 0 }]}
                    onChange={(value) => setTrackPan(track.id, value)}
                  />

                  {primarySend && (
                    <Stack gap={4}>
                      <Group gap={4} justify="space-between" align="center">
                        <Text size="xs" c="dimmed">
                          Send {primarySend.name}
                        </Text>
                        <Text size="xs" fw={600}>
                          {Math.round(primarySend.level * 100)}%
                        </Text>
                      </Group>
                      <Slider
                        min={0}
                        max={100}
                        value={Math.round(primarySend.level * 100)}
                        step={1}
                        onChange={(value) => setSendLevel(track.id, primarySend.id, value / 100)}
                      />
                    </Stack>
                  )}

                  <Group gap={6} align="center">
                    <Badge size="xs" color="gray" leftSection={<IconVolume size={12} />}>
                      {track.muted ? 'Muted' : 'Live'}
                    </Badge>
                    <Badge size="xs" color={track.solo ? 'yellow' : 'gray'} leftSection={<IconVolume3 size={12} />}>
                      {track.solo ? 'Solo' : 'Mix'}
                    </Badge>
                  </Group>
                </Stack>
              </Group>
            </Stack>
          </Card>
        )
      })}
    </Group>
  )
}
