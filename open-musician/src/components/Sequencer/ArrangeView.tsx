import {
  ActionIcon,
  Badge,
  Box,
  Button,
  ColorSwatch,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Slider,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import {
  IconCircleFilled,
  IconCopy,
  IconCut,
  IconHeadphones,
  IconCircleDot,
  IconVolumeOff,
  IconWaveSine,
} from '@tabler/icons-react'
import { useMemo } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { TimelineRuler } from './TimelineRuler'
import { StepSequencer } from './StepSequencer'
import { ScoreEditor } from './ScoreEditor'

const BEATS_PER_MEASURE = 4
const BASE_BEAT_WIDTH = 24

export function ArrangeView() {
  const tracks = useProjectStore((state) => state.tracks.filter((track) => track.type !== 'master'))
  const clips = useProjectStore((state) => state.clips)
  const markers = useProjectStore((state) => state.markers)
  const zoom = useProjectStore((state) => state.zoom)
  const setZoom = useProjectStore((state) => state.setZoom)
  const selectedTrackId = useProjectStore((state) => state.selectedTrackId)
  const selectedClipId = useProjectStore((state) => state.selectedClipId)
  const viewMode = useProjectStore((state) => state.viewMode)
  const setViewMode = useProjectStore((state) => state.setViewMode)
  const addClip = useProjectStore((state) => state.addClip)
  const selectTrack = useProjectStore((state) => state.selectTrack)
  const selectClip = useProjectStore((state) => state.selectClip)
  const duplicateClip = useProjectStore((state) => state.duplicateClip)
  const splitClip = useProjectStore((state) => state.splitClip)
  const updateClip = useProjectStore((state) => state.updateClip)
  const toggleTrackMute = useProjectStore((state) => state.toggleTrackMute)
  const toggleTrackSolo = useProjectStore((state) => state.toggleTrackSolo)
  const toggleTrackArm = useProjectStore((state) => state.toggleTrackArm)

  const beatWidth = BASE_BEAT_WIDTH * zoom
  const totalMeasures = useMemo(() => {
    if (!clips.length) return 8
    const furthestMeasure = Math.max(...clips.map((clip) => clip.start + clip.length))
    return Math.max(8, Math.ceil(furthestMeasure))
  }, [clips])

  const arrangementWidth = totalMeasures * BEATS_PER_MEASURE * beatWidth

  const selectedClip = useMemo(() => {
    if (!selectedClipId) return undefined
    return clips.find((clip) => clip.id === selectedClipId)
  }, [clips, selectedClipId])

  const handleAddClip = () => {
    if (!selectedTrackId) return
    const trackClips = clips.filter((clip) => clip.trackId === selectedTrackId)
    const lastEnd = trackClips.length ? Math.max(...trackClips.map((clip) => clip.start + clip.length)) : 0
    addClip({
      trackId: selectedTrackId,
      type: 'midi',
      name: 'New Idea',
      color: '#4ADE80',
      start: lastEnd,
      length: 2,
      loop: false,
      status: 'one-shot',
    })
  }

  const handleDuplicate = () => {
    if (!selectedClipId) return
    duplicateClip(selectedClipId)
  }

  const handleSplitMid = () => {
    if (!selectedClip) return
    const midPoint = selectedClip.start + selectedClip.length / 2
    splitClip(selectedClip.id, midPoint)
  }

  const handleToggleLoop = () => {
    if (!selectedClip) return
    updateClip(selectedClip.id, { loop: !selectedClip.loop, status: selectedClip.loop ? 'one-shot' : 'looping' })
  }

  return (
    <Paper withBorder p="md" radius="md" shadow="xs">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={0}>
            <Text size="sm" fw={600}>
              Arrangement
            </Text>
            <Text size="xs" c="dimmed">
              Zoom, drop markers, and sketch clips before diving into detailed editing.
            </Text>
          </Stack>
          <Group gap="md" align="center">
            <Stack gap={2} w={180}>
              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">
                  Zoom
                </Text>
                <Text size="xs" fw={600}>
                  {zoom.toFixed(2)}x
                </Text>
              </Group>
              <Slider min={0.5} max={4} step={0.1} value={zoom} onChange={setZoom} />
            </Stack>
            <SegmentedControl
              value={viewMode}
              onChange={(mode) => setViewMode(mode as typeof viewMode)}
              data={[
                { label: 'Arrange', value: 'arrange' },
                { label: 'Steps', value: 'step' },
                { label: 'Score', value: 'score' },
              ]}
            />

            <Group gap="xs" wrap="wrap">
              <Button size="xs" variant="light" leftSection={<IconCopy size={14} />} onClick={handleDuplicate} disabled={!selectedClipId}>
                Duplicate Clip
              </Button>
              <Button size="xs" variant="light" leftSection={<IconCut size={14} />} onClick={handleSplitMid} disabled={!selectedClipId}>
                Split Midpoint
              </Button>
              <Button size="xs" variant="light" leftSection={<IconWaveSine size={14} />} onClick={handleToggleLoop} disabled={!selectedClipId}>
                Toggle Loop
              </Button>
              {selectedClip && (
                <Badge color="grape" variant="light">
                  {selectedClip.name} · {selectedClip.length} bars
                </Badge>
              )}
            </Group>
            <Button variant="gradient" onClick={handleAddClip} disabled={!selectedTrackId}>
              Add Clip to Track
            </Button>
          </Group>
        </Group>

        <ScrollArea h={340} type="auto">
          <Stack gap="xs" pr="sm" className="timeline-lanes" style={{ width: arrangementWidth + 220 }}>
            <TimelineRuler totalMeasures={totalMeasures} beatWidth={beatWidth} markers={markers} />
            {tracks.map((track) => {
              const trackClips = clips
                .filter((clip) => clip.trackId === track.id)
                .sort((a, b) => a.start - b.start)
              return (
                <Box key={track.id} className="arrange-track">
                  <Box className="arrange-track-label" data-selected={selectedTrackId === track.id}>
                    <Group gap={6} align="center">
                      <ColorSwatch color={track.color} size={14} withShadow={false} radius="xs" />
                      <Text fw={600}>{track.name}</Text>
                      <Badge size="xs" variant="dot" color={track.type === 'audio' ? 'cyan' : 'grape'}>
                        {track.type}
                      </Badge>
                    </Group>
                    <Group gap={6} mt={6} align="center" wrap="wrap">
                      {track.instrumentId && (
                        <Badge size="xs" color="violet" variant="light">
                          {track.instrumentId}
                        </Badge>
                      )}
                      {track.effects.length > 0 && (
                        <Badge size="xs" color="orange" variant="light">
                          FX: {track.effects.length}
                        </Badge>
                      )}
                      {track.outputId && (
                        <Badge size="xs" color="gray" variant="light">
                          Out: {track.outputId}
                        </Badge>
                      )}
                    </Group>
                    <Group gap={6} mt={6} align="center">
                      <Tooltip label="Mute">
                        <ActionIcon
                          size="sm"
                          variant={track.muted ? 'filled' : 'light'}
                          color="red"
                          onClick={() => toggleTrackMute(track.id)}
                        >
                          <IconVolumeOff size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Solo">
                        <ActionIcon
                          size="sm"
                          variant={track.solo ? 'filled' : 'light'}
                          color="yellow"
                          onClick={() => toggleTrackSolo(track.id)}
                        >
                          <IconHeadphones size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Arm">
                        <ActionIcon
                          size="sm"
                          variant={track.armed ? 'filled' : 'light'}
                          color="teal"
                          onClick={() => toggleTrackArm(track.id)}
                        >
                          <IconCircleDot size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Select track">
                        <ActionIcon size="sm" variant="subtle" onClick={() => selectTrack(track.id)}>
                          <IconCircleFilled size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Box>
                  <Box className="arrange-track-lane" style={{ width: arrangementWidth }}>
                    {trackClips.length === 0 && (
                      <Text size="xs" c="dimmed">
                        Drop clips here to start building this section.
                      </Text>
                    )}
                    {trackClips.map((clip) => (
                      <Box
                        key={clip.id}
                        className="arrange-clip"
                        data-type={clip.type}
                        data-selected={selectedClipId === clip.id}
                        style={{
                          width: clip.length * BEATS_PER_MEASURE * beatWidth,
                          left: clip.start * BEATS_PER_MEASURE * beatWidth,
                          background: clip.color,
                        }}
                        title={`${clip.name} · ${clip.length} bars`}
                        onClick={() => {
                          selectTrack(clip.trackId)
                          selectClip(clip.id)
                        }}
                      >
                        <Text size="sm" fw={600}>
                          {clip.name}
                        </Text>
                        <Text size="xs">
                          {clip.length} bars · {clip.status === 'looping' ? 'Loop' : 'One Shot'}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )
            })}
          </Stack>
        </ScrollArea>

        {viewMode === 'step' && <StepSequencer stepData={selectedClip?.stepData} />}
        {viewMode === 'score' && <ScoreEditor notes={selectedClip?.notes} />}
      </Stack>
    </Paper>
  )
}
