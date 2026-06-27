import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { createExerciseRule, deleteExerciseRule } from '@/services/api';
import type { ExerciseRule } from '@/types/api';

interface ExerciseRulesEditorProps {
  exerciseId: number;
  rules: ExerciseRule[];
  onUpdated: () => void;
}

export const ExerciseRulesEditor: React.FC<ExerciseRulesEditorProps> = ({
  exerciseId,
  rules,
  onUpdated,
}) => {
  const [ruleName, setRuleName] = useState('Target ROM');
  const [joint, setJoint] = useState('knee');
  const [operator, setOperator] = useState('<=');
  const [value, setValue] = useState('90');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await createExerciseRule(exerciseId, {
        rule_name: ruleName,
        rule_type: 'threshold_comparison',
        parameters: { joint, side: 'right', parameter: 'angle', operator, value: parseFloat(value) },
      });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: number) => {
    await deleteExerciseRule(exerciseId, ruleId);
    onUpdated();
  };

  return (
    <div className="space-y-4 text-left">
      <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted">Exercise Rules</h4>
      {rules.length === 0 ? (
        <p className="text-xs text-chosen-text-muted">No rules configured.</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-2 p-2 rounded-chosen-sm border border-chosen bg-chosen-bg text-xs">
              <span className="font-semibold text-chosen-text-primary">{rule.rule_name}</span>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input label="Rule name" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
        <Select
          label="Joint"
          value={joint}
          onChange={(e) => setJoint(e.target.value)}
          options={[
            { value: 'knee', label: 'Knee' },
            { value: 'shoulder', label: 'Shoulder' },
            { value: 'elbow', label: 'Elbow' },
            { value: 'hip', label: 'Hip' },
          ]}
        />
        <Select
          label="Operator"
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          options={[
            { value: '>=', label: '>=' },
            { value: '<=', label: '<=' },
          ]}
        />
        <Input label="Value (°)" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button variant="secondary" size="sm" onClick={handleAdd} disabled={saving}>
        Add Rule
      </Button>
    </div>
  );
};
