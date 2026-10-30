import React, { useState } from 'react';
import {
  Activity,
  Compass
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';

export default function TrajectoryViewer({ trajectoryData = [], vehicles = [], incident }) {
  const [activeMetric, setActiveMetric] = useState('speed'); // 'speed' | 'accel'

  const safeTrajectoryData = Array.isArray(trajectoryData) ? trajectoryData : [];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D9DEE3]">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-xs font-sans font-medium px-2.5 py-0.5 rounded bg-[#EFF4F9] text-[#7189A6] border border-[#D6E2EC]">
              Module 05
            </span>
            <span className="text-xs text-[#697586] font-medium">Kinematics & trajectory modeling</span>
          </div>
          <h2 className="text-2xl font-bold text-[#25364A] tracking-tight">
            Vehicle Kinematics & Collision Vector Reconstruction
          </h2>
          <p className="text-xs text-[#697586] leading-relaxed">
            Synthesized CAN bus telemetry and simulated optical velocity profiles plotted across collision time-horizon.
          </p>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center space-x-2 text-xs font-sans">
          <button
            onClick={() => setActiveMetric('speed')}
            className={`px-3.5 py-2 rounded-md border transition ${
              activeMetric === 'speed'
                ? 'bg-[#EBF2EE] text-[#527D70] font-semibold border-[#D0E0D6]'
                : 'bg-white text-[#697586] border-[#D9DEE3] hover:text-[#25364A] hover:bg-[#F5F4EF]'
            }`}
          >
            Velocity curves (km/h)
          </button>
          <button
            onClick={() => setActiveMetric('accel')}
            className={`px-3.5 py-2 rounded-md border transition ${
              activeMetric === 'accel'
                ? 'bg-[#EBF2EE] text-[#527D70] font-semibold border-[#D0E0D6]'
                : 'bg-white text-[#697586] border-[#D9DEE3] hover:text-[#25364A] hover:bg-[#F5F4EF]'
            }`}
          >
            Deceleration profiles (g)
          </button>
        </div>
      </div>

      {/* Main Grid: Telemetry Graph + 2D Vector Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Left Side: Recharts Velocity/Decel Chart (7 cols) */}
        <div className="lg:col-span-7 rounded-lg bg-white border border-[#D9DEE3] p-6 lg:p-7 space-y-5 shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-[#EDF0F3]">
            <div className="flex items-center space-x-2.5">
              <Activity className="w-4 h-4 text-[#7189A6]" />
              <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
                {activeMetric === 'speed' ? 'Velocity profile (km/h vs time)' : 'Deceleration profile (g vs time)'}
              </h3>
            </div>
            <span className="text-xs font-sans text-[#B85C5C] font-semibold bg-[#FBF2F2] px-2.5 py-0.5 rounded border border-[#F1D7D7]">
              Impact: t = 0.0s
            </span>
          </div>

          {/* Recharts Component */}
          <div className="h-76 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={safeTrajectoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDF0F3" />
                <XAxis
                  dataKey="time"
                  stroke="#8A96A6"
                  tick={{ fill: '#697586', fontSize: 11, fontFamily: 'monospace' }}
                />
                <YAxis
                  stroke="#8A96A6"
                  tick={{ fill: '#697586', fontSize: 11, fontFamily: 'monospace' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#D9DEE3',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#25364A',
                    boxShadow: '0 4px 12px rgba(37, 54, 74, 0.08)',
                  }}
                  itemStyle={{ padding: '2px 0' }}
                />
                <Legend
                  wrapperStyle={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px',
                    paddingTop: '10px',
                    color: '#25364A'
                  }}
                />
                <ReferenceLine
                  x="0.0s (Impact)"
                  stroke="#B85C5C"
                  strokeDasharray="4 4"
                  label={{ value: 'IMPACT', fill: '#B85C5C', fontSize: 11, position: 'top', fontFamily: 'monospace' }}
                />

                {activeMetric === 'speed' ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey="v1_speed"
                      name="VEH-01 (Tesla Model 3)"
                      stroke="#C18A45"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="v2_speed"
                      name="VEH-02 (Ford Explorer)"
                      stroke="#527D70"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                  </>
                ) : (
                  <>
                    <Line
                      type="monotone"
                      dataKey="v1_accel"
                      name="VEH-01 Deceleration (g)"
                      stroke="#C18A45"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="v2_accel"
                      name="VEH-02 Deceleration (g)"
                      stroke="#7189A6"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-[#EDF0F3] text-xs text-[#697586] flex items-center justify-between font-sans">
            <span>Brake onset: <strong className="text-[#C18A45] font-mono">t - 0.380s</strong> (0.38s reaction window)</span>
            <span>Collision angle: <strong className="text-[#25364A] font-mono">52° Oblique</strong></span>
          </div>
        </div>

        {/* Right Side: 2D Collision Vector & Intersection Geometry (5 cols) */}
        <div className="lg:col-span-5 rounded-lg bg-white border border-[#D9DEE3] p-6 lg:p-7 flex flex-col justify-between shadow-card">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#EDF0F3]">
              <div className="flex items-center space-x-2.5">
                <Compass className="w-4 h-4 text-[#7189A6]" />
                <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#25364A]">
                  2D trajectory geometry & vector map
                </h3>
              </div>
              <span className="text-xs font-mono text-[#8A96A6]">Scale 1:250</span>
            </div>

            {/* Clean Light CAD Vector Canvas */}
            <div className="mt-4 relative h-68 rounded-lg bg-[#FAFAF8] border border-[#D9DEE3] overflow-hidden cad-grid p-4 flex flex-col justify-between">
              {/* North Arrow */}
              <div className="absolute top-2.5 right-2.5 text-xs font-mono text-[#697586] flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-[#D9DEE3] shadow-xs">
                <span>N</span>
                <span className="text-[#527D70] font-bold">↑</span>
              </div>

              {/* Road Lane Lines */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-20 bg-white/80 border-y border-dashed border-[#D9DEE3]"></div>
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-20 bg-white/80 border-x border-dashed border-[#D9DEE3]"></div>

              {/* Intersection Box */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-[#B5BDC6] bg-[#EFF4F9]/40"></div>

              {/* Vehicle 1 Vector (Tesla approaching from South, Northbound) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-4 flex flex-col items-center">
                <div className="w-7 h-10 rounded bg-[#FAF4EB] border-2 border-[#C18A45] flex items-center justify-center text-xs font-mono text-[#C18A45] font-bold shadow-xs">
                  V1
                </div>
                <div className="h-6 w-0.5 bg-[#C18A45]"></div>
                <span className="text-xs font-mono font-semibold text-[#C18A45]">84 km/h ↑</span>
              </div>

              {/* Vehicle 2 Vector (Ford Explorer turning left from East) */}
              <div className="absolute top-1/2 right-4 -translate-y-4 flex items-center">
                <span className="text-xs font-mono font-semibold text-[#527D70] mr-1.5">← 44 km/h</span>
                <div className="w-6 h-0.5 bg-[#527D70]"></div>
                <div className="w-10 h-7 rounded bg-[#EBF2EE] border-2 border-[#527D70] flex items-center justify-center text-xs font-mono text-[#527D70] font-bold shadow-xs">
                  V2
                </div>
              </div>

              {/* Vehicle 3 Stationary (Sprinter at Westbound Stop Line) */}
              <div className="absolute top-1/2 left-5 -translate-y-4">
                <div className="w-11 h-7 rounded bg-white border border-[#8A96A6] flex items-center justify-center text-xs font-mono text-[#697586] shadow-xs">
                  V3 (0km/h)
                </div>
              </div>

              {/* Primary Impact Flash at Center */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-[#FBF2F2] border border-[#F1D7D7] absolute"></div>
                <div className="w-4 h-4 rounded-full bg-[#B85C5C] flex items-center justify-center text-white text-[9px] font-bold font-mono">
                  t0
                </div>
              </div>

              {/* Trajectory deflection indicator */}
              <div className="absolute top-1/2 left-1/3 -translate-y-1/2 text-xs font-sans text-[#B85C5C] bg-white px-2 py-0.5 rounded border border-[#F1D7D7] shadow-xs">
                Deflection vector → V3
              </div>
            </div>
          </div>

          {/* Kinematics Metrics Footer */}
          <div className="mt-5 pt-3.5 border-t border-[#EDF0F3] grid grid-cols-3 gap-3 text-xs font-sans">
            <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
              <div className="text-xs text-[#8A96A6]">Impulse energy</div>
              <div className="text-[#25364A] font-mono font-bold mt-0.5">384 kJ</div>
            </div>
            <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
              <div className="text-xs text-[#8A96A6]">Peak deceleration</div>
              <div className="text-[#B85C5C] font-mono font-bold mt-0.5">-1.64 g</div>
            </div>
            <div className="p-3 rounded-md bg-[#FAFAF8] border border-[#D9DEE3]">
              <div className="text-xs text-[#8A96A6]">Post-impact yaw</div>
              <div className="text-[#C18A45] font-mono font-bold mt-0.5">+118° Spin</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
