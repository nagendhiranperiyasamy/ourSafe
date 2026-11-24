import React, { useState } from 'react';
import {
  Check,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { SosContact } from '../../types/safety';
import { formatPhoneForTel, isValidPhoneNumber } from '../../utils/storage';

interface SosContactsModalProps {
  contacts: SosContact[];
  onSaveContacts: (nextContacts: SosContact[]) => void;
  onClose: () => void;
}

export const SosContactsModal: React.FC<SosContactsModalProps> = ({
  contacts,
  onSaveContacts,
  onClose,
}) => {
  const [isAdding, setIsAdding] = useState(contacts.length === 0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('Guardian');
  const [formError, setFormError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRelation, setEditRelation] = useState('');
  const [editError, setEditError] = useState('');

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || name.trim().length < 2) {
      setFormError('Enter a guardian name (at least 2 characters).');
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setFormError('Enter a valid phone number (10 to 15 digits).');
      return;
    }

    const newContact: SosContact = {
      id: `contact-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      relation: relation.trim() || 'Emergency Contact',
      isPrimary: contacts.length === 0,
    };

    onSaveContacts([...contacts, newContact]);
    setName('');
    setPhone('');
    setRelation('Guardian');
    setIsAdding(false);
  };

  const startEdit = (contact: SosContact) => {
    setEditingId(contact.id);
    setEditName(contact.name);
    setEditPhone(contact.phone);
    setEditRelation(contact.relation);
    setEditError('');
  };

  const saveEdit = (id: string) => {
    setEditError('');
    if (!editName.trim() || editName.trim().length < 2) {
      setEditError('Name must be at least 2 characters.');
      return;
    }
    if (!isValidPhoneNumber(editPhone)) {
      setEditError('Enter a valid phone number (10 to 15 digits).');
      return;
    }

    const next = contacts.map((c) =>
      c.id === id
        ? {
            ...c,
            name: editName.trim(),
            phone: editPhone.trim(),
            relation: editRelation.trim() || 'Emergency Contact',
          }
        : c
    );
    onSaveContacts(next);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const remaining = contacts.filter((c) => c.id !== id);
    if (remaining.length > 0 && !remaining.some((c) => c.isPrimary)) {
      remaining[0] = { ...remaining[0], isPrimary: true };
    }
    onSaveContacts(remaining);
  };

  const handleMakePrimary = (id: string) => {
    const next = contacts.map((c) => ({ ...c, isPrimary: c.id === id }));
    onSaveContacts(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#182215]/55 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sos-contacts-heading"
    >
      <div className="w-full max-w-xl bg-[#FCFDF9] rounded-3xl border border-[#B8C6A8] p-6 sm:p-7 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold text-[#3E5632]">
              Emergency Circle · Offline-Ready Contacts
            </p>
            <h2
              id="sos-contacts-heading"
              className="text-xl font-semibold text-[#182215] mt-0.5"
            >
              Manage SOS Contacts
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close contacts manager"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:bg-[#EAF0E2] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add SOS Number Trigger / Form */}
        {!isAdding ? (
          <button
            type="button"
            onClick={() => {
              setIsAdding(true);
              setFormError('');
            }}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold flex items-center justify-center gap-2 transition-colors mb-5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add SOS Number</span>
          </button>
        ) : (
          <form
            onSubmit={handleAddContact}
            className="mb-5 rounded-2xl bg-[#F4F7EF] border border-[#CFD9C3] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#182215] flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[#2F4526]" />
                <span>Add New Emergency Contact</span>
              </span>
              {contacts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs font-semibold text-[#4B5844] hover:text-[#182215] cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            {formError && (
              <p className="text-xs font-medium text-red-600">{formError}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Guardian Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Meera Nair"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#C5D2B7] text-sm focus:border-[#2F4526] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Guardian Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9820112233"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#C5D2B7] text-sm font-mono tabular-nums focus:border-[#2F4526] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-7">
                <label className="block text-xs font-semibold text-[#182215] mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  placeholder="Mother, Sister, Friend, Partner..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#C5D2B7] text-sm focus:border-[#2F4526] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-5">
                <button
                  type="submit"
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#2F4526] hover:bg-[#23351C] text-[#F6F9F2] text-sm font-semibold cursor-pointer"
                >
                  Save Contact
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Saved Contacts List */}
        {contacts.length === 0 ? (
          <p className="text-sm text-[#54634D] text-center py-6">
            No SOS contacts saved yet. Add at least one trusted guardian above.
          </p>
        ) : (
          <div className="divide-y divide-[#DCE5D1] border border-[#CFD9C3] rounded-2xl overflow-hidden">
            {contacts.map((contact) => {
              const isEditing = editingId === contact.id;
              return (
                <div key={contact.id} className="p-4 bg-white">
                  {isEditing ? (
                    <div className="space-y-3">
                      {editError && (
                        <p className="text-xs font-medium text-red-600">{editError}</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                          aria-label="Edit guardian name"
                          className="min-h-[42px] px-3 py-1.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                        />
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="Phone"
                          aria-label="Edit guardian phone"
                          className="min-h-[42px] px-3 py-1.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm font-mono tabular-nums focus:bg-white focus:border-[#2F4526] focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editRelation}
                          onChange={(e) => setEditRelation(e.target.value)}
                          placeholder="Relation"
                          aria-label="Edit relation"
                          className="min-h-[42px] px-3 py-1.5 rounded-xl bg-[#F4F7EF] border border-[#C5D2B7] text-sm focus:bg-white focus:border-[#2F4526] focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold text-[#4B5844] hover:bg-[#EAF0E2] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(contact.id)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#2F4526] hover:bg-[#23351C] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-bold text-[#182215]">
                          <span className="truncate">{contact.name}</span>
                          {contact.isPrimary && (
                            <span className="text-xs font-semibold text-[#3E5632]">
                              · Primary
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#54634D] mt-0.5">
                          <span className="font-mono tabular-nums">
                            {contact.phone}
                          </span>{' '}
                          · {contact.relation || 'Emergency Contact'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!contact.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleMakePrimary(contact.id)}
                            title="Set as Primary Guardian"
                            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#54634D] hover:text-[#2F4526] hover:bg-[#EAF0E2] transition-colors cursor-pointer"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <a
                          href={`tel:${formatPhoneForTel(contact.phone)}`}
                          title={`Call ${contact.name}`}
                          className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#2F4526] hover:bg-[#EAF0E2] transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => startEdit(contact)}
                          aria-label={`Edit ${contact.name}`}
                          className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#4B5844] hover:text-[#2F4526] hover:bg-[#EAF0E2] transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(contact.id)}
                          aria-label={`Delete ${contact.name}`}
                          className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#4B5844] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
